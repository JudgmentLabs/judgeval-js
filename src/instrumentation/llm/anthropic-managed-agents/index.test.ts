import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Anthropic } from "@anthropic-ai/sdk";
import { SpanStatusCode } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { BaseTracer } from "../../../trace/BaseTracer";
import { JudgmentTracerProvider } from "../../../trace/JudgmentTracerProvider";
import { NoOpSpanExporter } from "../../../trace/exporters/NoOpSpanExporter";
import type { JudgmentSpanExporter } from "../../../trace/exporters/JudgmentSpanExporter";
import { JudgmentSpanProcessor } from "../../../trace/processors/JudgmentSpanProcessor";
import { wrapAnthropicManagedAgents } from "./index";

interface WireEvent {
  type: string;
  [field: string]: unknown;
}

const SESSION_ID = "sesn_1";
const THREAD_ID = "sthr_2";
const AGENT = {
  name: "concierge",
  model: { id: "claude-haiku-4-5" },
  system: "Be brief.",
};

class FakeTracer extends BaseTracer {
  constructor(
    provider: BasicTracerProvider,
    private readonly processor: JudgmentSpanProcessor,
  ) {
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
    return this.processor;
  }

  getSpanExporter(): JudgmentSpanExporter {
    return new NoOpSpanExporter();
  }
}

let exporter: InMemorySpanExporter;
let processor: JudgmentSpanProcessor;
let cleanup: () => void;

beforeEach(() => {
  exporter = new InMemorySpanExporter();
  processor = new JudgmentSpanProcessor(null, exporter);
  const tracer = new FakeTracer(
    new BasicTracerProvider({ spanProcessors: [processor] }),
    processor,
  );
  const proxy = JudgmentTracerProvider.getInstance();
  const previous = proxy.getActiveTracer();
  proxy.register(tracer);
  proxy.setActive(tracer);
  cleanup = () => {
    proxy.deregister(tracer);
    proxy.restoreActive(previous);
  };
});

afterEach(() => {
  cleanup();
});

const T0 = Date.parse("2026-10-05T17:55:00Z");
let sequence = 0;

function event(type: string, secs: number, fields = {}): WireEvent {
  return {
    id: `sevt_${++sequence}`,
    type,
    processed_at: new Date(T0 + secs * 1000).toISOString(),
    ...fields,
  };
}

function text(value: string): { type: string; text: string }[] {
  return [{ type: "text", text: value }];
}

function usage(inputTokens: number, outputTokens: number): object {
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  };
}

function idle(secs: number, reason = "end_turn"): WireEvent {
  return event("session.status_idle", secs, { stop_reason: { type: reason } });
}

/** The user asks, the agent runs a tool, then answers. */
function toolTurn(at = 0): WireEvent[] {
  const id = (name: string) => `${name}_${at}`;
  return [
    event("session.status_running", at),
    event("user.message", at + 0.1, { content: text("What is 2+2?") }),
    event("span.model_request_start", at + 0.1, { id: id("req1") }),
    event("agent.message", at + 1, { content: text("Let me check.") }),
    event("agent.tool_use", at + 1, {
      id: id("tool"),
      name: "bash",
      input: { command: "echo 4" },
    }),
    event("span.model_request_end", at + 1, {
      model_request_start_id: id("req1"),
      model_usage: usage(100, 20),
    }),
    event("agent.tool_result", at + 3, {
      tool_use_id: id("tool"),
      content: text("4"),
    }),
    event("span.model_request_start", at + 3.1, { id: id("req2") }),
    event("agent.message", at + 4, { content: text("It is 4.") }),
    event("span.model_request_end", at + 4, {
      model_request_start_id: id("req2"),
      model_usage: usage(150, 10),
    }),
    idle(at + 4.1),
  ];
}

/** The coordinator hands a task to a sub-agent and answers with its reply. */
function delegationTurn(): WireEvent[] {
  return [
    event("session.status_running", 0),
    event("user.message", 0.1, { content: text("Any policies for Jane?") }),
    event("span.model_request_start", 0.1, { id: "req1" }),
    event("agent.thread_message_sent", 1, {
      to_session_thread_id: THREAD_ID,
      to_agent_name: "specialist",
      content: text("Find Jane's policies"),
    }),
    event("span.model_request_end", 1, {
      model_request_start_id: "req1",
      model_usage: usage(100, 20),
    }),
    event("session.thread_status_idle", 3.3, {
      session_thread_id: THREAD_ID,
      stop_reason: { type: "end_turn" },
    }),
    event("agent.thread_message_received", 4, {
      from_session_thread_id: THREAD_ID,
      from_agent_name: "specialist",
      content: text("One policy: P-1001"),
    }),
    event("span.model_request_start", 4.1, { id: "req2" }),
    event("agent.message", 5, { content: text("Jane has one policy.") }),
    event("span.model_request_end", 5, {
      model_request_start_id: "req2",
      model_usage: usage(150, 10),
    }),
    idle(5.1),
  ];
}

/** The sub-agent's thread: it searches, then replies to the coordinator. */
function specialistThread(at = 0): WireEvent[] {
  return [
    event("session.thread_status_running", at + 1.2, {
      session_thread_id: THREAD_ID,
    }),
    event("agent.thread_message_received", at + 1.3, {
      from_session_thread_id: "sthr_1",
      from_agent_name: "concierge",
      content: text("Find Jane's policies"),
    }),
    event("span.model_request_start", at + 1.3, { id: "sub1" }),
    event("agent.custom_tool_use", at + 2, {
      id: "tool_sub",
      name: "search_policies",
      input: { client: "Jane" },
    }),
    event("span.model_request_end", at + 2, {
      model_request_start_id: "sub1",
      model_usage: usage(200, 30),
    }),
    event("session.thread_status_idle", at + 2.1, {
      session_thread_id: THREAD_ID,
      stop_reason: { type: "requires_action" },
    }),
    event("user.custom_tool_result", at + 2.5, {
      custom_tool_use_id: "tool_sub",
      content: text("P-1001"),
    }),
    event("span.model_request_start", at + 2.6, { id: "sub2" }),
    event("agent.message", at + 3, { content: text("Found P-1001") }),
    event("agent.thread_message_sent", at + 3.1, {
      to_session_thread_id: "sthr_1",
      to_agent_name: "concierge",
      content: text("One policy: P-1001"),
    }),
    event("span.model_request_end", at + 3.2, {
      model_request_start_id: "sub2",
      model_usage: usage(300, 2),
    }),
    event("session.thread_status_idle", at + 3.3, {
      session_thread_id: THREAD_ID,
      stop_reason: { type: "end_turn" },
    }),
  ];
}

function toSse(events: WireEvent[]): string {
  return events
    .map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`)
    .join("");
}

/**
 * A client backed by the real SDK that serves `events` as the session's
 * stream, and `threadEvents` as the events of the sub-agent thread. The stream
 * starts once the session has been retrieved.
 */
function clientServing(
  events: WireEvent[],
  threadEvents?: WireEvent[],
): Anthropic {
  let retrieved = () => {};
  const retrievedPromise = new Promise<void>((resolve) => {
    retrieved = resolve;
  });
  return new Anthropic({
    apiKey: "test",
    maxRetries: 0,
    fetch: (input) => {
      const thread = /\/threads\/[^/?]+(\/events)?\?/.exec(String(input));
      if (thread) {
        if (!threadEvents)
          return Promise.resolve(Response.json({}, { status: 404 }));
        return Promise.resolve(
          Response.json(
            thread[1]
              ? { data: threadEvents, next_page: null }
              : {
                  id: THREAD_ID,
                  agent: { ...AGENT, type: "agent", name: "specialist" },
                },
          ),
        );
      }
      if (!String(input).includes("/events/stream")) {
        setTimeout(retrieved, 0);
        return Promise.resolve(Response.json({ id: SESSION_ID, agent: AGENT }));
      }
      const body = new ReadableStream<string>({
        async start(controller) {
          await retrievedPromise;
          controller.enqueue(toSse(events));
          controller.close();
        },
      }).pipeThrough(new TextEncoderStream());
      return Promise.resolve(
        new Response(body, {
          headers: { "content-type": "text/event-stream" },
        }),
      );
    },
  });
}

/** Waits for the sub-agent threads, which are read in the background. */
async function settle(): Promise<void> {
  let count = -1;
  while (exporter.getFinishedSpans().length !== count) {
    count = exporter.getFinishedSpans().length;
    await new Promise((resolve) => setTimeout(resolve, 10));
    await processor.forceFlush();
  }
}

async function runSession(
  events: WireEvent[],
  stopAfter = events.length,
  threadEvents?: WireEvent[],
): Promise<{ received: unknown[]; spans: ReadableSpan[] }> {
  const client = wrapAnthropicManagedAgents(
    clientServing(events, threadEvents),
  );
  const received: unknown[] = [];
  for await (const item of await client.beta.sessions.events.stream(
    SESSION_ID,
  )) {
    received.push(item);
    if (received.length >= stopAfter) break;
  }
  await settle();
  return { received, spans: exporter.getFinishedSpans() };
}

function spanNamed(spans: ReadableSpan[], name: string): ReadableSpan {
  const span = spans.find((candidate) => candidate.name === name);
  if (!span) throw new Error(`No span named ${name}`);
  return span;
}

/** The run of the sub-agent that the coordinator transferred to. */
function subAgentRun(spans: ReadableSpan[]): ReadableSpan {
  const transfer = spanNamed(spans, "execute_tool transfer_to_agent");
  const run = spans.find(
    (span) => span.parentSpanContext?.spanId === transfer.spanContext().spanId,
  );
  if (!run) throw new Error("No sub-agent run under the transfer");
  return run;
}

interface RecordedMessage {
  role: string;
  content?: string;
}

function messages(span: ReadableSpan, key: string): RecordedMessage[] {
  const recorded: RecordedMessage[] = JSON.parse(String(span.attributes[key]));
  return recorded;
}

describe("wrapAnthropicManagedAgents", () => {
  test("passes the stream's events through", async () => {
    const events = toolTurn();
    const { received } = await runSession(events);
    expect(received).toEqual(events);
  });

  test("traces a turn as an agent run with its model requests and tool calls", async () => {
    const { spans } = await runSession(toolTurn());
    expect(spans.map((span) => span.name).sort()).toEqual([
      "execute_tool bash",
      "generate_content",
      "generate_content",
      "invoke_agent",
    ]);
  });

  test("records the user message and the final reply on the agent run", async () => {
    const { spans } = await runSession(toolTurn());
    const root = spanNamed(spans, "invoke_agent");
    expect([
      messages(root, AttributeKeys.JUDGMENT_INPUT),
      root.attributes[AttributeKeys.JUDGMENT_OUTPUT],
    ]).toEqual([[{ role: "user", content: "What is 2+2?" }], "It is 4."]);
  });

  test("records model, usage and the conversation so far on a model request", async () => {
    const { spans } = await runSession(toolTurn());
    const second = spans.filter((span) => span.name.startsWith("generate"))[1];
    expect([
      second.attributes[AttributeKeys.JUDGMENT_LLM_MODEL_NAME],
      second.attributes[AttributeKeys.JUDGMENT_USAGE_OUTPUT_TOKENS],
      messages(second, AttributeKeys.JUDGMENT_INPUT).map((m) => m.role),
    ]).toEqual([
      "claude-haiku-4-5",
      10,
      ["system", "user", "assistant", "assistant", "tool"],
    ]);
  });

  test("times a tool call from the call to its result", async () => {
    const { spans } = await runSession(toolTurn());
    const tool = spanNamed(spans, "execute_tool bash");
    expect([tool.startTime[0], tool.endTime[0] - tool.startTime[0]]).toEqual([
      Math.floor(T0 / 1000) + 1,
      2,
    ]);
  });

  test("groups spans by the Managed Agents session", async () => {
    const { spans } = await runSession(toolTurn());
    expect(
      spans.every(
        (span) =>
          span.attributes[AttributeKeys.JUDGMENT_SESSION_ID] === SESSION_ID,
      ),
    ).toBe(true);
  });

  test("keeps a turn open while the session waits for a tool result", async () => {
    const { spans } = await runSession([
      event("user.message", 0, { content: text("Search") }),
      event("agent.custom_tool_use", 1, {
        id: "tool_1",
        name: "search",
        input: {},
      }),
      idle(1.1, "requires_action"),
      event("user.custom_tool_result", 2, {
        custom_tool_use_id: "tool_1",
        content: text("found"),
      }),
      event("agent.message", 3, { content: text("Done") }),
      idle(3.1),
    ]);
    expect(spans.map((span) => span.name).sort()).toEqual([
      "execute_tool search",
      "invoke_agent",
    ]);
  });

  test("traces each turn of a session as its own trace", async () => {
    const { spans } = await runSession([...toolTurn(0), ...toolTurn(10)]);
    expect(new Set(spans.map((span) => span.spanContext().traceId)).size).toBe(
      2,
    );
  });

  test("marks the agent run failed when retries are exhausted", async () => {
    const { spans } = await runSession([
      event("user.message", 0, { content: text("Hi") }),
      idle(1, "retries_exhausted"),
    ]);
    expect(spanNamed(spans, "invoke_agent").status.code).toBe(
      SpanStatusCode.ERROR,
    );
  });

  test("marks a tool call without a result failed when the turn fails", async () => {
    const { spans } = await runSession([
      event("user.message", 0, { content: text("Search") }),
      event("agent.custom_tool_use", 1, {
        id: "tool_1",
        name: "search",
        input: {},
      }),
      idle(2, "budget_reached"),
    ]);
    expect(spanNamed(spans, "execute_tool search").status.code).toBe(
      SpanStatusCode.ERROR,
    );
  });

  test("traces a turn that the stream ends before it finishes", async () => {
    const { spans } = await runSession(toolTurn(), 4);
    expect(spanNamed(spans, "invoke_agent").name).toBe("invoke_agent");
  });

  test("records a sub-agent's run, model requests and tool calls", async () => {
    const { spans } = await runSession(
      delegationTurn(),
      undefined,
      specialistThread(),
    );
    expect(spans.map((span) => span.name).sort()).toEqual([
      "execute_tool search_policies",
      "execute_tool transfer_to_agent",
      "generate_content",
      "generate_content",
      "generate_content",
      "generate_content",
      "invoke_agent",
      "invoke_agent",
    ]);
  });

  test("nests the sub-agent's run under the transfer call", async () => {
    const { spans } = await runSession(
      delegationTurn(),
      undefined,
      specialistThread(),
    );
    expect(subAgentRun(spans).name).toBe("invoke_agent");
  });

  test("records the transfer's message and the sub-agent's reply on the call", async () => {
    const { spans } = await runSession(
      delegationTurn(),
      undefined,
      specialistThread(),
    );
    const transfer = spanNamed(spans, "execute_tool transfer_to_agent");
    expect([
      transfer.attributes[AttributeKeys.JUDGMENT_INPUT],
      transfer.attributes[AttributeKeys.JUDGMENT_OUTPUT],
    ]).toEqual([
      JSON.stringify({
        agent_name: "specialist",
        message: "Find Jane's policies",
      }),
      "One policy: P-1001",
    ]);
  });

  test("keeps a sub-agent's spans in the coordinator's trace and session", async () => {
    const { spans } = await runSession(
      delegationTurn(),
      undefined,
      specialistThread(),
    );
    expect([
      new Set(spans.map((span) => span.spanContext().traceId)).size,
      spans.every(
        (span) =>
          span.attributes[AttributeKeys.JUDGMENT_SESSION_ID] === SESSION_ID,
      ),
    ]).toEqual([1, true]);
  });

  test("records only the latest exchange when a thread is reused", async () => {
    const { spans } = await runSession(delegationTurn(), undefined, [
      ...specialistThread(-100),
      ...specialistThread(),
    ]);
    expect(subAgentRun(spans).startTime[0]).toBe(Math.floor(T0 / 1000) + 1);
  });

  test("traces the transfer when the sub-agent's thread cannot be read", async () => {
    const { spans } = await runSession(delegationTurn());
    expect(spans.map((span) => span.name).sort()).toEqual([
      "execute_tool transfer_to_agent",
      "generate_content",
      "generate_content",
      "invoke_agent",
    ]);
  });

  test("traces nothing when a session only changes status", async () => {
    const { spans } = await runSession([idle(0)]);
    expect(spans).toEqual([]);
  });
});
