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

/** Longest a turn's optional API lookups may take before spans are built without them. */
const ENRICHMENT_DEADLINE_MS = 10_000;

/** Test hook: lets tests shorten the enrichment deadline. */
export const managedAgentsTestHooks = {
  enrichmentDeadlineMs: ENRICHMENT_DEADLINE_MS,
};
/** Primary-thread events remembered per session (for LLM span inputs). */
const MAX_HISTORY_EVENTS = 1000;
/** Sessions remembered per client; the oldest is dropped beyond this. */
const MAX_SESSIONS = 100;

const wrappedResources = new WeakSet<object>();
const patchedStreams = new WeakSet<object>();
const histories = new WeakMap<object, Map<string, SessionState>>();

/** What is remembered between turns of one session. */
interface SessionState {
  /** Primary-thread events, for LLM span inputs. */
  events: Ev[];
  /** Sub-agent threads seen so far (thread id -> agent name). */
  threads: Map<string, string>;
}

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
        // A status event with no turn activity (e.g. an idle notification
        // before the first message) is not a turn.
        if (hasTurnActivity(finished)) await onTurn(finished, false);
      }
      yield event;
    }
  } finally {
    if (hasTurnActivity(turn)) await onTurn(turn, true);
  }
}

function hasTurnActivity(turn: Ev[]): boolean {
  return turn.some(
    (e) =>
      e.type.startsWith("user.") ||
      e.type.startsWith("agent.") ||
      e.type === "session.error",
  );
}

async function exportWithTimeout(
  client: object,
  sessionId: string,
  turn: Ev[],
  partial: boolean,
  parent: Context,
): Promise<void> {
  if (!getTraceRuntime().getActiveTracer()) return;
  try {
    await exportTurn(client, sessionId, turn, partial, parent);
  } catch (err) {
    Logger.error(
      `[Caught] An exception was raised in wrapAnthropicManagedAgents.exportTurn: ${String(err)}`,
    );
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

  const state = sessionState(client, sessionId);
  // Sub-agent threads touched this turn: named by a delegation event, or
  // created in an earlier turn and active again now.
  const named = new Map<string, string>();
  for (const e of turn) {
    if (e.type === "session.thread_created" && e.session_thread_id) {
      named.set(e.session_thread_id, e.agent_name ?? "agent");
    } else if (
      e.type === "agent.thread_message_sent" &&
      e.to_session_thread_id
    ) {
      named.set(e.to_session_thread_id, e.to_agent_name ?? "agent");
    } else if (
      e.type === "agent.thread_message_received" &&
      e.from_session_thread_id
    ) {
      named.set(e.from_session_thread_id, e.from_agent_name ?? "agent");
    }
  }
  for (const [id, name] of named) state.threads.set(id, name);
  const childThreads = new Map(named);
  for (const e of turn) {
    const id = e.session_thread_id;
    const known = id ? state.threads.get(id) : undefined;
    if (id && known !== undefined) childThreads.set(id, known);
  }
  const primaryTurn = turn.filter(
    (e) => !(e.session_thread_id && childThreads.has(e.session_thread_id)),
  );
  const prior = rememberPrimaryEvents(
    client,
    sessionId,
    state,
    primaryTurn,
    turn,
  );

  // Enrichment calls share one deadline; spans are always built afterwards
  // (with whatever was fetched) so the turn-ending event is never released
  // before they exist.
  const deadline = Date.now() + managedAgentsTestHooks.enrichmentDeadlineMs;

  const session = (
    await attempt("sessions.retrieve", deadline, () =>
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
    await attempt("sessions.threads.list", deadline, async () => {
      for await (const t of api.beta.sessions.threads.list(sessionId)) {
        threads.set(t.id, t);
      }
    });
    for (const [threadId, agentName] of childThreads) {
      const events: Ev[] = [];
      const read = await attempt(
        "sessions.threads.events.list",
        deadline,
        async () => {
          for await (const e of api.beta.sessions.threads.events.list(
            threadId,
            {
              session_id: sessionId,
            },
          )) {
            events.push(e);
          }
        },
      );
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

function sessionState(client: object, sessionId: string): SessionState {
  let perClient = histories.get(client);
  if (!perClient) {
    perClient = new Map();
    histories.set(client, perClient);
  }
  return perClient.get(sessionId) ?? { events: [], threads: new Map() };
}

/**
 * Append this turn's primary-thread events to the session history and return
 * the history as it was before the turn. The history is only used to show the
 * model's input on LLM spans; it is bounded and dropped when the session ends.
 */
function rememberPrimaryEvents(
  client: object,
  sessionId: string,
  state: SessionState,
  primaryTurn: Ev[],
  turn: Ev[],
): Ev[] {
  const perClient = histories.get(client) ?? new Map<string, SessionState>();
  histories.set(client, perClient);
  const prior = state.events;
  perClient.delete(sessionId);
  const ended = turn.some(
    (e) =>
      e.type === "session.status_terminated" || e.type === "session.deleted",
  );
  if (!ended) {
    perClient.set(sessionId, {
      events: [...prior, ...primaryTurn].slice(-MAX_HISTORY_EVENTS),
      threads: state.threads,
    });
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

/**
 * Run an Anthropic API call used only for enrichment. Failures and calls still
 * pending at `deadline` are logged and skipped, never thrown; a late result is
 * ignored.
 */
async function attempt<R>(
  label: string,
  deadline: number,
  fn: () => Promise<R>,
): Promise<{ value: R } | undefined> {
  const remaining = deadline - Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (remaining <= 0) throw new Error("deadline exceeded");
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timed out")), remaining);
      timer.unref?.();
    });
    const call = fn();
    call.catch(() => undefined);
    return { value: await Promise.race([call, timeout]) };
  } catch (err) {
    Logger.error(
      `[Caught] Managed Agents ${label} failed; the trace will be missing detail: ${String(err)}`,
    );
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
