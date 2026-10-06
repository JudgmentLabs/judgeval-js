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
import { managedAgentsTestHooks, wrapAnthropicManagedAgents } from "./index";
import type { ManagedAgentEvent as Ev } from "./types";

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
      (v) => String(v),
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
const ev = (type: string, secs: number, extra: Partial<Ev> = {}): Ev => ({
  id: `sevt_${++seq}`,
  type,
  processed_at: new Date(T0 + secs * 1000).toISOString(),
  ...extra,
});
const words = (text: string) => [{ type: "text", text }];

const AGENT = {
  name: "concierge",
  model: { id: "claude-haiku-4-5" },
  system: "Be brief.",
};
const CHILD = "sthr_child";
const idle = (secs: number, type = "end_turn", ids?: string[]) =>
  ev("session.status_idle", secs, {
    stop_reason: { type, ...(ids ? { event_ids: ids } : {}) },
  });

/** Coordinator delegates to `specialist`, which runs a custom tool; the app answers it. */
function delegationTurn(): { primary: Ev[]; child: Ev[] } {
  const primary = [
    ev("session.status_running", 0),
    ev("user.message", 0.1, { content: words("Find retirement events") }),
    ev("span.model_request_start", 0.1, { id: "ms1" }),
    ev("span.model_request_end", 1.5, {
      model_request_start_id: "ms1",
      is_error: false,
      model_usage: {
        input_tokens: 3051,
        output_tokens: 294,
        cache_read_input_tokens: 10,
        cache_creation_input_tokens: 20,
      },
    }),
    ev("session.thread_created", 1.6, {
      session_thread_id: CHILD,
      agent_name: "specialist",
    }),
    ev("agent.thread_message_sent", 1.6, {
      to_session_thread_id: CHILD,
      to_agent_name: "specialist",
      content: words("Search events"),
    }),
    ev("agent.custom_tool_use", 3, {
      id: "tu1",
      name: "search_events",
      input: { query: "retirement" },
      session_thread_id: CHILD,
    }),
    idle(3.5, "requires_action", ["tu1"]),
    ev("user.custom_tool_result", 4.5, {
      custom_tool_use_id: "tu1",
      session_thread_id: CHILD,
      content: words("Summit"),
    }),
    ev("agent.thread_message_received", 6, {
      from_session_thread_id: CHILD,
      from_agent_name: "specialist",
      content: words("Found Summit"),
    }),
    ev("span.model_request_start", 6.1, { id: "ms2" }),
    ev("agent.message", 7, { content: words("There is one event: Summit.") }),
    ev("span.model_request_end", 7.1, {
      model_request_start_id: "ms2",
      is_error: false,
      model_usage: { input_tokens: 4000, output_tokens: 100 },
    }),
    idle(7.2),
  ];
  const child = [
    ev("session.thread_status_running", 2),
    ev("agent.thread_message_received", 2.1, {
      from_session_thread_id: "sthr_primary",
      from_agent_name: "concierge",
      content: words("Search events"),
    }),
    ev("span.model_request_start", 2.1, { id: "cs1" }),
    ev("agent.custom_tool_use", 3, {
      id: "tu1",
      name: "search_events",
      input: { query: "retirement" },
    }),
    ev("span.model_request_end", 3, {
      model_request_start_id: "cs1",
      is_error: false,
      model_usage: { input_tokens: 1697, output_tokens: 128 },
    }),
    ev("user.custom_tool_result", 4.5, {
      custom_tool_use_id: "tu1",
      content: words("Summit"),
    }),
    ev("span.model_request_start", 4.6, { id: "cs2" }),
    ev("agent.message", 5.5, { content: words("Found Summit") }),
    ev("span.model_request_end", 5.6, {
      model_request_start_id: "cs2",
      is_error: false,
      model_usage: { input_tokens: 1900, output_tokens: 30 },
    }),
    ev("agent.thread_message_sent", 5.7, {
      to_session_thread_id: "sthr_primary",
      to_agent_name: "concierge",
      content: words("Found Summit"),
    }),
  ];
  return { primary, child };
}

/** A single agent calls a tool that needs the app's confirmation. */
function confirmationTurn(result: "allow" | "deny"): Ev[] {
  const denied = result === "deny";
  return [
    ev("user.message", 0.1, { content: words("Delete the leads file") }),
    ev("span.model_request_start", 0.1, { id: "ms1" }),
    ev("agent.tool_use", 1, {
      id: "tu1",
      name: "bash",
      input: { command: "rm leads.jsonl" },
      evaluated_permission: "ask",
    }),
    ev("span.model_request_end", 1, {
      model_request_start_id: "ms1",
      is_error: false,
      model_usage: { input_tokens: 500, output_tokens: 40 },
    }),
    idle(1.2, "requires_action", ["tu1"]),
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
      is_error: false,
      model_usage: { input_tokens: 600, output_tokens: 10 },
    }),
    idle(4.2),
  ];
}

// --- fake Anthropic client -------------------------------------------------

class FakeStream {
  constructor(private readonly events: Ev[]) {}
  [Symbol.asyncIterator]() {
    return this.iterator();
  }
  private async *iterator() {
    for (const e of this.events) yield e;
  }
}

async function* items<I>(list: I[]): AsyncGenerator<I> {
  for (const i of list) yield i;
}

function fakeClient(opts: {
  streams: Ev[][];
  children?: Record<string, Ev[]>;
  retrieveFails?: boolean;
  retrieveHangs?: boolean;
}) {
  const calls = { retrieve: 0 };
  let next = 0;
  const children = opts.children ?? {};
  const client = {
    beta: {
      sessions: {
        retrieve: () => {
          calls.retrieve++;
          if (opts.retrieveHangs) return new Promise(() => undefined);
          return opts.retrieveFails
            ? Promise.reject(new Error("retrieve failed"))
            : Promise.resolve({ agent: AGENT });
        },
        events: {
          stream: (_sessionId: string) =>
            Promise.resolve(new FakeStream(opts.streams[next++] ?? [])),
        },
        threads: {
          list: () =>
            items(
              Object.keys(children).map((id) => ({
                id,
                agent: {
                  name: "specialist",
                  model: { id: "claude-haiku-4-5" },
                },
              })),
            ),
          events: {
            list: (threadId: string) => items(children[threadId] ?? []),
          },
        },
      },
    },
  };
  return { client, calls };
}

/** Read one stream until the turn ends; returns what the app saw. */
async function consume(
  client: ReturnType<typeof fakeClient>["client"],
  stopAt: (e: Ev) => boolean = (e) =>
    e.type === "session.status_idle" &&
    e.stop_reason?.type !== "requires_action",
): Promise<Ev[]> {
  const stream = await client.beta.sessions.events.stream(SESSION);
  const seen: Ev[] = [];
  for await (const e of stream) {
    seen.push(e);
    if (stopAt(e)) break;
  }
  return seen;
}

// --- span helpers ----------------------------------------------------------

const finished = (): ReadableSpan[] => exporter.getFinishedSpans();
const named = (name: string): ReadableSpan[] =>
  finished().filter((s) => s.name === name);
const only = (name: string): ReadableSpan => {
  const [span] = named(name);
  if (!span) throw new Error(`no span named ${name}`);
  return span;
};
const childrenOf = (parent: ReadableSpan): ReadableSpan[] =>
  finished()
    .filter((s) => s.parentSpanContext?.spanId === parent.spanContext().spanId)
    .sort(
      (a, b) =>
        a.startTime[0] - b.startTime[0] ||
        a.startTime[1] - b.startTime[1] ||
        a.name.localeCompare(b.name),
    );
const tree = (span: ReadableSpan, depth = 0): string[] => [
  `${"  ".repeat(depth)}${span.name}`,
  ...childrenOf(span).flatMap((c) => tree(c, depth + 1)),
];

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
      (e) => e === primary[primary.length - 1],
    );
    expect(seen).toEqual(primary);
  });

  test("builds one invocation per turn, continuing across requires_action", async () => {
    const { primary, child } = delegationTurn();
    const { client } = fakeClient({
      streams: [primary],
      children: { [CHILD]: child },
    });
    wrapAnthropicManagedAgents(client);
    await consume(client);
    expect(named("invocation")).toHaveLength(1);
  });

  test("shapes spans as invocation > invoke_agent > model and tool calls", async () => {
    const { primary, child } = delegationTurn();
    const { client } = fakeClient({
      streams: [primary],
      children: { [CHILD]: child },
    });
    wrapAnthropicManagedAgents(client);
    await consume(client);
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
    const { primary, child } = delegationTurn();
    const { client } = fakeClient({
      streams: [primary],
      children: { [CHILD]: child },
    });
    wrapAnthropicManagedAgents(client);
    await consume(client);
    expect(new Set(finished().map((s) => s.attributes[SESSION_ID]))).toEqual(
      new Set([SESSION]),
    );
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
      sessionIds: [...new Set(finished().map((s) => s.attributes[SESSION_ID]))],
      invocationParent: only("invocation").parentSpanContext?.spanId,
      handler: only("handle_chat").spanContext().spanId,
    }).toEqual({
      sessionIds: ["chat-42"],
      invocationParent: only("handle_chat").spanContext().spanId,
      handler: only("handle_chat").spanContext().spanId,
    });
  });

  test("records model, token usage and provider on generate_content spans", async () => {
    const { primary, child } = delegationTurn();
    const { client } = fakeClient({
      streams: [primary],
      children: { [CHILD]: child },
    });
    wrapAnthropicManagedAgents(client);
    await consume(client);
    const llm = finished().find(
      (s) =>
        s.name.startsWith("generate_content") &&
        s.attributes["judgment.usage.output_tokens"] === 294,
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

  test("spans are exported before the terminal event reaches the app", async () => {
    const { primary, child } = delegationTurn();
    const { client } = fakeClient({
      streams: [primary],
      children: { [CHILD]: child },
    });
    wrapAnthropicManagedAgents(client);
    let atIdle = -1;
    await consume(client, (e) => {
      const end =
        e.type === "session.status_idle" && e.stop_reason?.type === "end_turn";
      if (end) atIdle = named("invocation").length;
      return end;
    });
    expect(atIdle).toBe(1);
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
      status: tool.status,
      waitParent: only("await_user_confirmation").parentSpanContext?.spanId,
      tool: tool.spanContext().spanId,
    }).toEqual({
      status: {
        code: SpanStatusCode.ERROR,
        message: "denied by user: Not permitted",
      },
      waitParent: tool.spanContext().spanId,
      tool: tool.spanContext().spanId,
    });
  });

  test("fails the invocation when the session stops at its budget", async () => {
    const events = [
      ev("user.message", 0.1, { content: words("hi") }),
      ev("span.model_request_start", 0.1, { id: "ms1" }),
      ev("agent.message", 1, { content: words("partial") }),
      ev("span.model_request_end", 1.1, {
        model_request_start_id: "ms1",
        is_error: false,
      }),
      idle(1.2, "budget_reached"),
    ];
    const { client } = fakeClient({ streams: [events] });
    wrapAnthropicManagedAgents(client);
    await consume(client);
    expect(only("invocation").status).toEqual({
      code: SpanStatusCode.ERROR,
      message: "budget_reached",
    });
  });

  test("surfaces a sub-agent session.error that is only in the thread's events", async () => {
    const { primary, child } = delegationTurn();
    const error = ev("session.error", 5, {
      error: {
        type: "mcp_authentication_failed_error",
        message: "no credential",
        mcp_server_name: "crm",
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
      invocation: "mcp_authentication_failed_error: no credential",
    });
  });

  test("exports an incomplete trace when the app abandons the stream mid-turn", async () => {
    const { primary, child } = delegationTurn();
    const { client } = fakeClient({
      streams: [primary],
      children: { [CHILD]: child },
    });
    wrapAnthropicManagedAgents(client);
    await consume(client, (e) => e.stop_reason?.type === "requires_action");
    expect(
      only("invocation").attributes["anthropic.managed_agents.incomplete"],
    ).toBe(true);
  });

  test("shows earlier turns of the session as input to later model requests", async () => {
    const first = [
      ev("user.message", 0.1, { content: words("first question") }),
      ev("span.model_request_start", 0.1, { id: "ms1" }),
      ev("agent.message", 1, { content: words("first answer") }),
      ev("span.model_request_end", 1.1, {
        model_request_start_id: "ms1",
        is_error: false,
      }),
      idle(1.2),
    ];
    const second = [
      ev("user.message", 10, { content: words("second question") }),
      ev("span.model_request_start", 10.1, { id: "ms2" }),
      ev("agent.message", 11, { content: words("second answer") }),
      ev("span.model_request_end", 11.1, {
        model_request_start_id: "ms2",
        is_error: false,
      }),
      idle(11.2),
    ];
    const { client } = fakeClient({ streams: [first, second] });
    wrapAnthropicManagedAgents(client);
    await consume(client);
    await consume(client);
    const lastLlm = named("generate_content claude-haiku-4-5")[1];
    expect(
      JSON.parse(String(lastLlm?.attributes["judgment.input"])).map(
        (m: { role: string; content: string }) => `${m.role}: ${m.content}`,
      ),
    ).toEqual([
      "system: Be brief.",
      "user: first question",
      "assistant: first answer",
      "user: second question",
    ]);
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

  test("builds spans before releasing the terminal event when an API lookup hangs", async () => {
    const errorLog = spyOn(Logger, "error").mockImplementation(() => undefined);
    const previous = managedAgentsTestHooks.enrichmentDeadlineMs;
    managedAgentsTestHooks.enrichmentDeadlineMs = 30;
    try {
      const { client } = fakeClient({
        streams: [confirmationTurn("allow")],
        retrieveHangs: true,
      });
      wrapAnthropicManagedAgents(client);
      let atIdle = -1;
      await consume(client, (e) => {
        const end = e.type === "session.status_idle";
        if (end) atIdle = named("invoke_agent agent").length;
        return end && e.stop_reason?.type !== "requires_action";
      });
      expect(atIdle).toBeGreaterThan(0);
    } finally {
      managedAgentsTestHooks.enrichmentDeadlineMs = previous;
      errorLog.mockRestore();
    }
  });

  test("keeps attributing a sub-agent thread reused in a later turn", async () => {
    const { primary, child } = delegationTurn();
    const second = [
      ev("user.message", 100, { content: words("Anything else?") }),
      ev("agent.custom_tool_use", 101, {
        id: "tu2",
        name: "search_events",
        input: {},
        session_thread_id: CHILD,
      }),
      idle(102, "requires_action", ["tu2"]),
      ev("user.custom_tool_result", 103, {
        custom_tool_use_id: "tu2",
        session_thread_id: CHILD,
        content: words("none"),
      }),
      ev("agent.message", 104, { content: words("No.") }),
      idle(105),
    ];
    const childLater = [
      ...child,
      ev("agent.custom_tool_use", 101, {
        id: "tu2",
        name: "search_events",
        input: {},
      }),
    ];
    const { client } = fakeClient({
      streams: [primary, second],
      children: { [CHILD]: childLater },
    });
    wrapAnthropicManagedAgents(client);
    await consume(client);
    await consume(client);
    const lastConcierge = named("invoke_agent concierge")[1];
    expect(
      lastConcierge && childrenOf(lastConcierge).map((s) => s.name),
    ).toEqual([]);
    expect(named("invoke_agent specialist")).toHaveLength(2);
  });

  test("does not export a trace for an idle notification that precedes any activity", async () => {
    const stream = [
      idle(0),
      ev("user.message", 1, { content: words("hello") }),
      ev("agent.message", 2, { content: words("hi") }),
      idle(3),
    ];
    const { client } = fakeClient({ streams: [stream] });
    wrapAnthropicManagedAgents(client);
    let idles = 0;
    await consume(
      client,
      (e) => e.type === "session.status_idle" && ++idles === 2,
    );
    expect(named("invocation")).toHaveLength(1);
  });

  test("takes the agent input from the first message, not a leading status event", async () => {
    const { primary, child } = delegationTurn();
    const { client } = fakeClient({
      streams: [primary],
      children: { [CHILD]: child },
    });
    wrapAnthropicManagedAgents(client);
    await consume(client);
    expect(
      JSON.parse(
        String(only("invoke_agent concierge").attributes["judgment.input"]),
      ),
    ).toEqual([{ role: "user", content: "Find retirement events" }]);
  });

  test("wrapping a client twice does not duplicate traces", async () => {
    const { client } = fakeClient({ streams: [confirmationTurn("allow")] });
    wrapAnthropicManagedAgents(wrapAnthropicManagedAgents(client));
    await consume(client);
    expect(named("invocation")).toHaveLength(1);
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
