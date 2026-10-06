import type { Context } from "@opentelemetry/api";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { BaseTracer } from "../../../trace/BaseTracer";
import { getBaggage } from "../../../trace/baggage";
import { getTraceRuntime } from "../../../trace/runtime";
import { dontThrow } from "../../../utils/dont-throw";
import { Logger } from "../../../utils/logger";
import { emitTurn, isTurnEnd, ms, type AgentRun } from "./build-spans";
import type {
  ManagedAgentConfig,
  ManagedAgentEvent as Ev,
  ManagedAgentsApi,
  ManagedAgentsClientLike,
  ManagedAgentThread,
} from "./types";

export type { ManagedAgentEvent, ManagedAgentsClientLike } from "./types";

/** Longest the stream waits for a turn to be exported before moving on. */
const EXPORT_TIMEOUT_MS = 10_000;
/** Primary-thread events remembered per session (for LLM span inputs). */
const MAX_HISTORY_EVENTS = 1000;
/** Sessions remembered per client; the oldest is dropped beyond this. */
const MAX_SESSIONS = 100;

const wrappedResources = new WeakSet<object>();
const patchedStreams = new WeakSet<object>();
const histories = new WeakMap<object, Map<string, Ev[]>>();

type StreamFn = ManagedAgentsApi["beta"]["sessions"]["events"]["stream"];

/**
 * Instrument an Anthropic client so Claude Managed Agents sessions are traced.
 *
 * Managed Agents run the agent loop on Anthropic's infrastructure, so there is
 * no local model call to wrap. Instead this patches
 * `client.beta.sessions.events.stream` so that the event stream your app
 * already consumes is observed. Events pass through unchanged. When a turn
 * ends (the session goes idle, other than waiting on a tool result or
 * confirmation) one trace is exported:
 *
 * ```
 * invocation
 * ├─ invoke_agent <agent>
 * │  ├─ generate_content <model>    one per model request, with token usage
 * │  ├─ execute_tool <tool>         built-in, MCP and custom tools
 * │  └─ execute_tool transfer_to_agent   delegation to a sub-agent thread
 * └─ invoke_agent <sub-agent>       one per sub-agent thread
 * ```
 *
 * Sub-agent threads are not on the primary stream, so they are read from
 * `client.beta.sessions.threads` when the turn ends. Every span carries
 * `judgment.session_id`: the id set with `Tracer.setSessionId()` if there is
 * one, otherwise the Managed Agents session id. Spans nest under the active
 * span, if any.
 *
 * Only Managed Agents session streams are traced; `messages.create` and other
 * Anthropic calls are not.
 *
 * @param client - An Anthropic client (`new Anthropic()`).
 * @returns The same client instance, instrumented in-place.
 *
 * @example
 * ```typescript
 * import Anthropic from "@anthropic-ai/sdk";
 * import { Tracer, wrapAnthropicManagedAgents } from "judgeval";
 *
 * await Tracer.init({ projectName: "my-project" });
 * const client = wrapAnthropicManagedAgents(new Anthropic());
 *
 * const stream = await client.beta.sessions.events.stream(session.id);
 * await client.beta.sessions.events.send(session.id, { events: [...] });
 * for await (const event of stream) {
 *   if (event.type === "session.status_idle") break;
 * }
 * await Tracer.forceFlush();
 * ```
 */
export function wrapAnthropicManagedAgents<T extends ManagedAgentsClientLike>(
  client: T,
): T {
  dontThrow("wrapAnthropicManagedAgents", () => {
    const events = client.beta.sessions.events as unknown as {
      stream: StreamFn;
    };
    if (wrappedResources.has(events)) return;
    wrappedResources.add(events);

    const original = events.stream.bind(events);
    events.stream = (sessionId, ...rest) => {
      const result = original(sessionId, ...rest);
      // Register before returning so the stream is patched before the caller's
      // own `await` resumes. Rejections are left for the caller to handle.
      if (isThenable(result)) {
        result.then(
          (stream) => patchStream(client, sessionId, stream),
          () => undefined,
        );
      } else {
        patchStream(client, sessionId, result);
      }
      return result;
    };
  });
  return client;
}

function isThenable<V>(value: unknown): value is PromiseLike<V> {
  return typeof (value as PromiseLike<V> | undefined)?.then === "function";
}

function patchStream(
  client: object,
  sessionId: string,
  stream: AsyncIterable<Ev>,
): void {
  dontThrow("wrapAnthropicManagedAgents.patchStream", () => {
    if (patchedStreams.has(stream)) return;
    patchedStreams.add(stream);

    const original = stream[Symbol.asyncIterator].bind(stream);
    (stream as { [Symbol.asyncIterator]: () => AsyncIterator<Ev> })[
      Symbol.asyncIterator
    ] = () => {
      // Spans nest under whatever is active when iteration starts.
      const parent = getTraceRuntime().getCurrentContext();
      return tapEvents(original(), (turn, partial) =>
        exportWithTimeout(client, sessionId, turn, partial, parent),
      );
    };
  });
}

/**
 * Yield every event unchanged, handing each finished turn to `onTurn` first so
 * the spans exist by the time the caller sees the terminal event (and can
 * safely `Tracer.forceFlush()`). Events buffered when the stream ends or is
 * abandoned mid-turn are exported as an incomplete turn.
 */
async function* tapEvents(
  source: AsyncIterator<Ev>,
  onTurn: (turn: Ev[], partial: boolean) => Promise<void>,
): AsyncGenerator<Ev> {
  let turn: Ev[] = [];
  try {
    for await (const event of { [Symbol.asyncIterator]: () => source }) {
      turn.push(event);
      if (isTurnEnd(event)) {
        const finished = turn;
        turn = [];
        await onTurn(finished, false);
      }
      yield event;
    }
  } finally {
    if (
      turn.some((e) => e.type === "user.message" || e.type.startsWith("agent."))
    ) {
      await onTurn(turn, true);
    }
  }
}

async function exportWithTimeout(
  client: object,
  sessionId: string,
  turn: Ev[],
  partial: boolean,
  parent: Context,
): Promise<void> {
  if (!getTraceRuntime().getActiveTracer()) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, EXPORT_TIMEOUT_MS);
    timer.unref?.();
  });
  const exported = exportTurn(client, sessionId, turn, partial, parent).catch(
    (err: unknown) => {
      Logger.error(
        `[Caught] An exception was raised in wrapAnthropicManagedAgents.exportTurn: ${String(err)}`,
      );
    },
  );
  try {
    await Promise.race([exported, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function exportTurn(
  client: object,
  sessionId: string,
  turn: Ev[],
  partial: boolean,
  parent: Context,
): Promise<void> {
  const api = client as unknown as ManagedAgentsApi;
  const start = ms(turn[0]) ?? Date.now();

  // Sub-agent threads touched this turn: created now, or reused from an
  // earlier turn.
  const childThreads = new Map<string, string>();
  for (const e of turn) {
    if (e.type === "session.thread_created" && e.session_thread_id) {
      childThreads.set(e.session_thread_id, e.agent_name ?? "agent");
    } else if (
      e.type === "agent.thread_message_sent" &&
      e.to_session_thread_id
    ) {
      childThreads.set(e.to_session_thread_id, e.to_agent_name ?? "agent");
    } else if (
      e.type === "agent.thread_message_received" &&
      e.from_session_thread_id
    ) {
      childThreads.set(e.from_session_thread_id, e.from_agent_name ?? "agent");
    }
  }
  const primaryTurn = turn.filter(
    (e) => !(e.session_thread_id && childThreads.has(e.session_thread_id)),
  );
  const prior = rememberPrimaryEvents(client, sessionId, primaryTurn, turn);

  const session = (
    await attempt("sessions.retrieve", () =>
      Promise.resolve(api.beta.sessions.retrieve(sessionId)),
    )
  )?.value;
  const agents: AgentRun[] = [
    {
      name: session?.agent?.name ?? "agent",
      model: modelId(session?.agent),
      system: session?.agent?.system ?? undefined,
      isChild: false,
      events: [...prior, ...primaryTurn],
      from: prior.length,
    },
  ];

  if (childThreads.size) {
    const threads = new Map<string, ManagedAgentThread>();
    await attempt("sessions.threads.list", async () => {
      for await (const t of api.beta.sessions.threads.list(sessionId)) {
        threads.set(t.id, t);
      }
    });
    for (const [threadId, agentName] of childThreads) {
      const events: Ev[] = [];
      const read = await attempt("sessions.threads.events.list", async () => {
        for await (const e of api.beta.sessions.threads.events.list(threadId, {
          session_id: sessionId,
        })) {
          events.push(e);
        }
      });
      if (!read) continue;
      const thread = threads.get(threadId);
      const first = events.findIndex((e) => (ms(e) ?? 0) >= start);
      agents.push({
        name: agentName,
        model: modelId(thread?.agent),
        system: thread?.agent?.system ?? undefined,
        threadId,
        isChild: true,
        events,
        from: first < 0 ? events.length : first,
      });
    }
  }

  const baggageSessionId = getBaggage(parent)?.getEntry(
    AttributeKeys.JUDGMENT_SESSION_ID,
  )?.value;
  emitTurn(BaseTracer.getOTELTracer(), parent, {
    sessionId,
    traceSessionId: baggageSessionId ?? sessionId,
    turn,
    agents,
    partial,
  });
}

/**
 * Append this turn's primary-thread events to the session history and return
 * the history as it was before the turn. The history is only used to show the
 * model's input on LLM spans; it is bounded and dropped when the session ends.
 */
function rememberPrimaryEvents(
  client: object,
  sessionId: string,
  primaryTurn: Ev[],
  turn: Ev[],
): Ev[] {
  let perClient = histories.get(client);
  if (!perClient) {
    perClient = new Map();
    histories.set(client, perClient);
  }
  const prior = perClient.get(sessionId) ?? [];
  perClient.delete(sessionId);
  const ended = turn.some(
    (e) =>
      e.type === "session.status_terminated" || e.type === "session.deleted",
  );
  if (!ended) {
    perClient.set(
      sessionId,
      [...prior, ...primaryTurn].slice(-MAX_HISTORY_EVENTS),
    );
    const oldest = perClient.keys().next().value;
    if (perClient.size > MAX_SESSIONS && oldest !== undefined) {
      perClient.delete(oldest);
    }
  }
  return prior;
}

function modelId(agent: ManagedAgentConfig | undefined): string | undefined {
  const model = agent?.model;
  return typeof model === "string" ? model : model?.id;
}

/** Run an Anthropic API call used only for enrichment; failures are logged, never thrown. */
async function attempt<R>(
  label: string,
  fn: () => Promise<R>,
): Promise<{ value: R } | undefined> {
  try {
    return { value: await fn() };
  } catch (err) {
    Logger.error(
      `[Caught] Managed Agents ${label} failed; the trace will be missing detail: ${String(err)}`,
    );
    return undefined;
  }
}
