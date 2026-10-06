import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { SpanStatusCode } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import { BaseTracer } from "../../../trace/BaseTracer";
import { JudgmentTracerProvider } from "../../../trace/JudgmentTracerProvider";
import { NoOpSpanExporter } from "../../../trace/exporters/NoOpSpanExporter";
import { NoOpSpanProcessor } from "../../../trace/processors/NoOpSpanProcessor";
import { JudgmentBaggageSpanProcessor } from "../../../trace/processors/JudgmentBaggageSpanProcessor";
import type { JudgmentSpanExporter } from "../../../trace/exporters/JudgmentSpanExporter";
import type { JudgmentSpanProcessor } from "../../../trace/processors/JudgmentSpanProcessor";
import { Logger } from "../../../utils/logger";
import { wrap } from "../../index";
import { wrapAnthropicManagedAgents } from "./index";
import type { RequestOptions, SessionEvent } from "./types";

const SESSION = "sesn_1";
const SESSION_ID = "judgment.session_id";

class FakeTracer extends BaseTracer {
  constructor(provider: BasicTracerProvider) {
    super(
      "test-project",
      "test-project-id",
      "test-key",
      "test-org",
      "https://example.com",
      null,
      JSON.stringify,
      provider,
      null,
      false,
    );
  }

  getSpanProcessor(): JudgmentSpanProcessor {
    return new NoOpSpanProcessor() as unknown as JudgmentSpanProcessor;
  }

  getSpanExporter(): JudgmentSpanExporter {
    return new NoOpSpanExporter();
  }
}

let exporter: InMemorySpanExporter;
let cleanup: () => void;
let deactivate: () => void;

beforeEach(() => {
  exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [
      new JudgmentBaggageSpanProcessor(),
      new SimpleSpanProcessor(exporter),
    ],
  });
  const tracer = new FakeTracer(provider);
  const proxy = JudgmentTracerProvider.getInstance();
  const previous = proxy.getActiveTracer();
  proxy.register(tracer);
  proxy.setActive(tracer);
  deactivate = () => proxy.restoreActive(null);
  cleanup = () => {
    proxy.deregister(tracer);
    proxy.restoreActive(previous);
  };
});

afterEach(() => {
  cleanup();
});

// --- fixtures --------------------------------------------------------------

const T0 = Date.parse("2026-10-05T17:55:00Z");
let seq = 0;
const ev = (
  type: string,
  secs: number,
  extra: Partial<SessionEvent> = {},
): SessionEvent => ({
  id: `sevt_${++seq}`,
  type,
  processed_at: new Date(T0 + secs * 1000).toISOString(),
  ...extra,
});
const words = (text: string) => [{ type: "text", text }];
const idle = (secs: number, type = "end_turn") =>
  ev("session.status_idle", secs, { stop_reason: { type } });
const requiresAction = (secs: number) => idle(secs, "requires_action");

const AGENT = {
  name: "concierge",
  model: { id: "claude-haiku-4-5" },
  system: "Be brief.",
};
const CHILD = "sthr_child";

/**
 * The coordinator delegates to `specialist`, which calls a custom tool that
 * the app answers. `at` shifts the turn in time so a session can have several.
 */
function delegationTurn(at = 0): {
  primary: SessionEvent[];
  child: SessionEvent[];
} {
  const e = (type: string, secs: number, extra: Partial<SessionEvent> = {}) =>
    ev(type, at + secs, { ...extra });
  const id = (name: string) => `${name}_${at}`;
  const primary = [
    e("session.status_running", 0),
    e("user.message", 0.1, { content: words("Find retirement events") }),
    e("span.model_request_start", 0.1, { id: id("ms1") }),
    e("span.model_request_end", 1.5, {
      model_request_start_id: id("ms1"),
      model_usage: {
        input_tokens: 3051,
        output_tokens: 294,
        cache_read_input_tokens: 10,
        cache_creation_input_tokens: 20,
      },
    }),
    e("session.thread_created", 1.6, { session_thread_id: CHILD }),
    e("agent.thread_message_sent", 1.6, {
      to_session_thread_id: CHILD,
      to_agent_name: "specialist",
      content: words("Search events"),
    }),
    e("agent.custom_tool_use", 3, {
      id: id("tu1"),
      name: "search_events",
      input: { query: "retirement" },
      session_thread_id: CHILD,
    }),
    requiresAction(at + 3.5),
    e("user.custom_tool_result", 4.5, {
      custom_tool_use_id: id("tu1"),
      session_thread_id: CHILD,
      content: words("Summit"),
    }),
    e("agent.thread_message_received", 6, {
      from_session_thread_id: CHILD,
      from_agent_name: "specialist",
      content: words("Found Summit"),
    }),
    e("span.model_request_start", 6.1, { id: id("ms2") }),
    e("agent.message", 7, { content: words("There is one event: Summit.") }),
    e("span.model_request_end", 7.1, {
      model_request_start_id: id("ms2"),
      model_usage: {
        input_tokens: 4000,
        output_tokens: 100,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    }),
    idle(at + 7.2),
  ];
  const child = [
    e("session.thread_status_running", 2),
    e("agent.thread_message_received", 2.1, {
      from_session_thread_id: "sthr_primary",
      from_agent_name: "concierge",
      content: words("Search events"),
    }),
    e("span.model_request_start", 2.1, { id: id("cs1") }),
    e("agent.custom_tool_use", 3, {
      id: id("tu1"),
      name: "search_events",
      input: { query: "retirement" },
    }),
    e("span.model_request_end", 3, {
      model_request_start_id: id("cs1"),
      model_usage: {
        input_tokens: 1697,
        output_tokens: 128,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    }),
    e("user.custom_tool_result", 4.5, {
      custom_tool_use_id: id("tu1"),
      content: words("Summit"),
    }),
    e("span.model_request_start", 4.6, { id: id("cs2") }),
    e("agent.message", 5.5, { content: words("Found Summit") }),
    e("span.model_request_end", 5.6, {
      model_request_start_id: id("cs2"),
      model_usage: {
        input_tokens: 1900,
        output_tokens: 30,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    }),
    e("agent.thread_message_sent", 5.7, {
      to_session_thread_id: "sthr_primary",
      to_agent_name: "concierge",
      content: words("Found Summit"),
    }),
  ];
  return { primary, child };
}

/** A single agent calls a tool that needs the app's confirmation. */
function confirmationTurn(result: "allow" | "deny"): SessionEvent[] {
  const denied = result === "deny";
  return [
    ev("user.message", 0.1, { content: words("Delete the leads file") }),
    ev("span.model_request_start", 0.1, { id: "ms1" }),
    ev("agent.tool_use", 1, {
      id: "tu1",
      name: "bash",
      input: { command: "rm leads.jsonl" },
    }),
    ev("span.model_request_end", 1, {
      model_request_start_id: "ms1",
      model_usage: {
        input_tokens: 500,
        output_tokens: 40,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    }),
    requiresAction(1.2),
    ev("user.tool_confirmation", 3, {
      tool_use_id: "tu1",
      result,
      ...(denied ? { deny_message: "Not permitted" } : {}),
    }),
    ...(denied
      ? []
      : [
          ev("agent.tool_result", 3.5, {
            tool_use_id: "tu1",
            content: words("ok"),
          }),
        ]),
    ev("span.model_request_start", 3.6, { id: "ms2" }),
    ev("agent.message", 4, { content: words("Done.") }),
    ev("span.model_request_end", 4.1, {
      model_request_start_id: "ms2",
      model_usage: {
        input_tokens: 600,
        output_tokens: 10,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    }),
    idle(4.2),
  ];
}

// --- fake Anthropic client -------------------------------------------------

class FakeStream {
  constructor(private readonly events: SessionEvent[]) {}
  [Symbol.asyncIterator]() {
    return this.iterator();
  }
  private async *iterator() {
    for (const event of this.events) yield event;
  }
}

async function* items<I>(list: I[]): AsyncGenerator<I> {
  for (const item of list) yield item;
}

function fakeClient(options: {
  streams: SessionEvent[][];
  children?: Record<string, SessionEvent[]>;
  retrieveFails?: boolean;
}) {
  const calls = {
    retrieve: 0,
    retrieveOptions: undefined as RequestOptions | undefined,
  };
  let nextStream = 0;
  const children = options.children ?? {};
  const client = {
    beta: {
      sessions: {
        retrieve: (
          _sessionId: string,
          _params: null,
          requestOptions: RequestOptions,
        ) => {
          calls.retrieve++;
          calls.retrieveOptions = requestOptions;
          return options.retrieveFails
            ? Promise.reject(new Error("retrieve failed"))
            : Promise.resolve({ agent: AGENT });
        },
        events: {
          stream: (_sessionId: string) =>
            Promise.resolve(
              new FakeStream(options.streams[nextStream++] ?? []),
            ),
        },
        threads: {
          list: () =>
            items([
              { id: "sthr_primary", parent_thread_id: null, agent: AGENT },
              ...Object.keys(children).map((id) => ({
                id,
                parent_thread_id: "sthr_primary",
                agent: {
                  name: "specialist",
                  model: { id: "claude-haiku-4-5" },
                },
              })),
            ]),
          events: {
            list: (threadId: string) => items(children[threadId] ?? []),
          },
        },
      },
    },
  };
  return { client, calls };
}

/** Read one stream until `stopAt` (by default, the end of a turn); returns what the app saw. */
async function consume(
  client: ReturnType<typeof fakeClient>["client"],
  stopAt: (event: SessionEvent) => boolean = (event) =>
    event.type === "session.status_idle" &&
    event.stop_reason?.type !== "requires_action",
): Promise<SessionEvent[]> {
  const stream = await client.beta.sessions.events.stream(SESSION);
  const seen: SessionEvent[] = [];
  for await (const event of stream) {
    seen.push(event);
    if (stopAt(event)) break;
  }
  return seen;
}

// --- span helpers ----------------------------------------------------------

const finished = (): ReadableSpan[] => exporter.getFinishedSpans();
const named = (name: string): ReadableSpan[] =>
  finished().filter((span) => span.name === name);
const only = (name: string): ReadableSpan => {
  const [span] = named(name);
  if (!span) throw new Error(`no span named ${name}`);
  return span;
};
const childrenOf = (parent: ReadableSpan): ReadableSpan[] =>
  finished()
    .filter(
      (span) => span.parentSpanContext?.spanId === parent.spanContext().spanId,
    )
    .sort(
      (a, b) =>
        a.startTime[0] - b.startTime[0] ||
        a.startTime[1] - b.startTime[1] ||
        a.name.localeCompare(b.name),
    );
const tree = (span: ReadableSpan, depth = 0): string[] => [
  `${"  ".repeat(depth)}${span.name}`,
  ...childrenOf(span).flatMap((child) => tree(child, depth + 1)),
];
const inputOf = (span: ReadableSpan): { role: string; content?: string }[] =>
  JSON.parse(String(span.attributes["judgment.input"]));

/** Wrap a fake client whose single stream is a delegation turn, and read it. */
async function traceDelegation() {
  const { primary, child } = delegationTurn();
  const { client } = fakeClient({
    streams: [primary],
    children: { [CHILD]: child },
  });
  wrapAnthropicManagedAgents(client);
  await consume(client);
  return { primary, client };
}

// --- tests -----------------------------------------------------------------

describe("wrapAnthropicManagedAgents", () => {
  test("passes every event through unchanged and in order", async () => {
    const { primary, child } = delegationTurn();
    const { client } = fakeClient({
      streams: [primary],
      children: { [CHILD]: child },
    });
    wrapAnthropicManagedAgents(client);
    const seen = await consume(
      client,
      (event) => event === primary[primary.length - 1],
    );
    expect(seen).toEqual(primary);
  });

  test("builds one invocation per turn, continuing across requires_action", async () => {
    await traceDelegation();
    expect(named("invocation")).toHaveLength(1);
  });

  test("shapes spans as invocation > invoke_agent > model and tool calls", async () => {
    await traceDelegation();
    expect(tree(only("invocation"))).toEqual([
      "invocation",
      "  invoke_agent concierge",
      "    generate_content claude-haiku-4-5",
      "    execute_tool transfer_to_agent",
      "    generate_content claude-haiku-4-5",
      "  invoke_agent specialist",
      "    generate_content claude-haiku-4-5",
      "    execute_tool search_events",
      "    generate_content claude-haiku-4-5",
    ]);
  });

  test("puts the same judgment.session_id on every span", async () => {
    await traceDelegation();
    expect(
      new Set(finished().map((span) => span.attributes[SESSION_ID])),
    ).toEqual(new Set([SESSION]));
  });

  test("puts judgment.session_id on the confirmation wait span too", async () => {
    const { client } = fakeClient({ streams: [confirmationTurn("allow")] });
    wrapAnthropicManagedAgents(client);
    await consume(client);
    expect(only("await_user_confirmation").attributes[SESSION_ID]).toBe(
      SESSION,
    );
  });

  test("uses Tracer.setSessionId and nests under the active span", async () => {
    const { primary, child } = delegationTurn();
    const { client } = fakeClient({
      streams: [primary],
      children: { [CHILD]: child },
    });
    wrapAnthropicManagedAgents(client);
    await BaseTracer.span("handle_chat", async () => {
      BaseTracer.setSessionId("chat-42");
      await consume(client);
    });
    expect({
      sessionIds: [
        ...new Set(finished().map((span) => span.attributes[SESSION_ID])),
      ],
      invocationParent: only("invocation").parentSpanContext?.spanId,
    }).toEqual({
      sessionIds: ["chat-42"],
      invocationParent: only("handle_chat").spanContext().spanId,
    });
  });

  test("records model, token usage and provider on generate_content spans", async () => {
    await traceDelegation();
    const llm = finished().find(
      (span) => span.attributes["judgment.usage.output_tokens"] === 294,
    );
    expect(llm?.attributes).toMatchObject({
      "judgment.span_kind": "llm",
      "judgment.llm.provider": "anthropic",
      "judgment.llm.model": "claude-haiku-4-5",
      "judgment.usage.non_cached_input_tokens": 3051,
      "judgment.usage.cache_read_input_tokens": 10,
      "judgment.usage.cache_creation_input_tokens": 20,
    });
  });

  test("gives a model request the system prompt and the turn's messages so far as input", async () => {
    const { client } = fakeClient({ streams: [confirmationTurn("allow")] });
    wrapAnthropicManagedAgents(client);
    await consume(client);
    const [, second] = named("generate_content claude-haiku-4-5");
    expect(inputOf(second).map(({ role, content }) => [role, content])).toEqual(
      [
        ["system", "Be brief."],
        ["user", "Delete the leads file"],
        ["assistant", undefined],
        ["tool", "ok"],
      ],
    );
  });

  test("exports spans before the terminal event reaches the app", async () => {
    const { primary, child } = delegationTurn();
    const { client } = fakeClient({
      streams: [primary],
      children: { [CHILD]: child },
    });
    wrapAnthropicManagedAgents(client);
    let exportedAtIdle = -1;
    await consume(client, (event) => {
      const isEnd =
        event.type === "session.status_idle" &&
        event.stop_reason?.type === "end_turn";
      if (isEnd) exportedAtIdle = named("invocation").length;
      return isEnd;
    });
    expect(exportedAtIdle).toBe(1);
  });

  test("records an allowed confirmation without an error", async () => {
    const { client } = fakeClient({ streams: [confirmationTurn("allow")] });
    wrapAnthropicManagedAgents(client);
    await consume(client);
    expect({
      status: only("execute_tool bash").status.code,
      confirmation: only("await_user_confirmation").attributes[
        "judgment.output"
      ],
    }).toEqual({ status: SpanStatusCode.UNSET, confirmation: "allow" });
  });

  test("marks a denied tool call as an error under await_user_confirmation", async () => {
    const { client } = fakeClient({ streams: [confirmationTurn("deny")] });
    wrapAnthropicManagedAgents(client);
    await consume(client);
    const tool = only("execute_tool bash");
    expect({
      status: tool.status.code,
      message: tool.status.message,
      waitParent: only("await_user_confirmation").parentSpanContext?.spanId,
    }).toEqual({
      status: SpanStatusCode.ERROR,
      message: "Error: denied by user: Not permitted",
      waitParent: tool.spanContext().spanId,
    });
  });

  test("fails the invocation when the session stops at its budget", async () => {
    const { client } = fakeClient({
      streams: [
        [
          ev("user.message", 0.1, { content: words("hi") }),
          ev("agent.message", 1, { content: words("partial") }),
          idle(1.2, "budget_reached"),
        ],
      ],
    });
    wrapAnthropicManagedAgents(client);
    await consume(client);
    expect(only("invocation").status.message).toBe("Error: budget_reached");
  });

  test("surfaces a sub-agent session.error that is only in the thread's events", async () => {
    const { primary, child } = delegationTurn();
    const error = ev("session.error", 5, {
      error: {
        type: "mcp_authentication_failed_error",
        message: "no credential",
        retry_status: { type: "terminal" },
      },
    });
    const { client } = fakeClient({
      streams: [primary],
      children: { [CHILD]: [...child, error] },
    });
    wrapAnthropicManagedAgents(client);
    await consume(client);
    expect({
      agent: only("invoke_agent specialist").status.code,
      invocation: only("invocation").status.message,
    }).toEqual({
      agent: SpanStatusCode.ERROR,
      invocation: "Error: mcp_authentication_failed_error: no credential",
    });
  });

  test("exports an incomplete trace when the app abandons the stream mid-turn", async () => {
    const { primary, child } = delegationTurn();
    const { client } = fakeClient({
      streams: [primary],
      children: { [CHILD]: child },
    });
    wrapAnthropicManagedAgents(client);
    await consume(
      client,
      (event) => event.stop_reason?.type === "requires_action",
    );
    expect(
      only("invocation").attributes["anthropic.managed_agents.incomplete"],
    ).toBe(true);
  });

  test("gives each turn only the events of a sub-agent thread that happened during it", async () => {
    const first = delegationTurn(0);
    const second = delegationTurn(100);
    const { client } = fakeClient({
      streams: [first.primary, second.primary],
      children: { [CHILD]: [...first.child, ...second.child] },
    });
    wrapAnthropicManagedAgents(client);
    await consume(client);
    await consume(client);
    expect(named("execute_tool search_events")).toHaveLength(2);
  });

  test("still traces the turn when sessions.retrieve fails", async () => {
    const errorLog = spyOn(Logger, "error").mockImplementation(() => undefined);
    try {
      const { client } = fakeClient({
        streams: [confirmationTurn("allow")],
        retrieveFails: true,
      });
      wrapAnthropicManagedAgents(client);
      await consume(client);
      expect(named("invoke_agent agent")).toHaveLength(1);
    } finally {
      errorLog.mockRestore();
    }
  });

  test("bounds the lookups made at the end of a turn with a timeout", async () => {
    const { client, calls } = fakeClient({
      streams: [confirmationTurn("allow")],
    });
    wrapAnthropicManagedAgents(client);
    await consume(client);
    expect(calls.retrieveOptions?.timeout).toBeGreaterThan(0);
  });

  test("does not export a trace for an idle notification that precedes any activity", async () => {
    const { client } = fakeClient({
      streams: [
        [
          idle(0),
          ev("user.message", 1, { content: words("hello") }),
          ev("agent.message", 2, { content: words("hi") }),
          idle(3),
        ],
      ],
    });
    wrapAnthropicManagedAgents(client);
    let idles = 0;
    await consume(
      client,
      (event) => event.type === "session.status_idle" && ++idles === 2,
    );
    expect(named("invocation")).toHaveLength(1);
  });

  test("takes the agent input from the first message, not a leading status event", async () => {
    await traceDelegation();
    expect(inputOf(only("invoke_agent concierge"))).toEqual([
      { role: "user", content: "Find retirement events" },
    ]);
  });

  test("does not call the Anthropic API when no tracer is active", async () => {
    const { client, calls } = fakeClient({
      streams: [confirmationTurn("allow")],
    });
    wrapAnthropicManagedAgents(client);
    deactivate();
    await consume(client);
    expect(calls.retrieve).toBe(0);
  });

  test("wrap() instruments clients that expose Managed Agents sessions", async () => {
    const { client } = fakeClient({ streams: [confirmationTurn("allow")] });
    wrap(client);
    await consume(client);
    expect(named("invocation")).toHaveLength(1);
  });
});
