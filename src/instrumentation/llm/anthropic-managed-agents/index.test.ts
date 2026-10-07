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

function toSse(events: WireEvent[]): string {
  return events
    .map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`)
    .join("");
}

/**
 * A client backed by the real SDK that serves `events` as the session's
 * stream. The stream starts once the session has been retrieved.
 */
function clientServing(events: WireEvent[]): Anthropic {
  let retrieved = () => {};
  const retrievedPromise = new Promise<void>((resolve) => {
    retrieved = resolve;
  });
  return new Anthropic({
    apiKey: "test",
    maxRetries: 0,
    fetch: (input) => {
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

async function runSession(
  events: WireEvent[],
  stopAfter = events.length,
): Promise<{ received: unknown[]; spans: ReadableSpan[] }> {
  const client = wrapAnthropicManagedAgents(clientServing(events));
  const received: unknown[] = [];
  for await (const item of await client.beta.sessions.events.stream(
    SESSION_ID,
  )) {
    received.push(item);
    if (received.length >= stopAfter) break;
  }
  await processor.forceFlush();
  return { received, spans: exporter.getFinishedSpans() };
}

function spanNamed(spans: ReadableSpan[], name: string): ReadableSpan {
  const span = spans.find((candidate) => candidate.name === name);
  if (!span) throw new Error(`No span named ${name}`);
  return span;
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
      "generate_content claude-haiku-4-5",
      "generate_content claude-haiku-4-5",
      "invoke_agent concierge",
    ]);
  });

  test("records the user message and the final reply on the agent run", async () => {
    const { spans } = await runSession(toolTurn());
    const root = spanNamed(spans, "invoke_agent concierge");
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

  test("nests the agent run under the active span and keeps the app's session ID", async () => {
    const spans = await BaseTracer.with("app", async () => {
      BaseTracer.setSessionId("app-session");
      return (await runSession(toolTurn())).spans;
    });
    const root = spanNamed(spans, "invoke_agent concierge");
    expect([
      root.parentSpanContext?.spanId,
      root.attributes[AttributeKeys.JUDGMENT_SESSION_ID],
    ]).toEqual([
      spanNamed(exporter.getFinishedSpans(), "app").spanContext().spanId,
      "app-session",
    ]);
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
      "invoke_agent concierge",
    ]);
  });

  test("traces each turn of a session as its own trace", async () => {
    const { spans } = await runSession([...toolTurn(0), ...toolTurn(10)]);
    expect(new Set(spans.map((span) => span.spanContext().traceId)).size).toBe(
      2,
    );
  });

  test("shows a sub-agent as a transfer_to_agent call and skips its cross-posted events", async () => {
    const { spans } = await runSession([
      event("user.message", 0, { content: text("Ask the specialist") }),
      event("agent.thread_message_sent", 1, {
        to_session_thread_id: "sthr_1",
        to_agent_name: "specialist",
        content: text("Search"),
      }),
      event("agent.custom_tool_use", 2, {
        id: "tool_1",
        name: "search",
        input: {},
        session_thread_id: "sthr_1",
      }),
      event("agent.thread_message_received", 5, {
        from_session_thread_id: "sthr_1",
        content: text("Found it"),
      }),
      idle(5.1),
    ]);
    expect(
      spans.map((span) => [
        span.name,
        span.attributes[AttributeKeys.JUDGMENT_OUTPUT],
      ]),
    ).toEqual([
      ["execute_tool transfer_to_agent", "Found it"],
      ["invoke_agent concierge", ""],
    ]);
  });

  test("marks the agent run failed when retries are exhausted", async () => {
    const { spans } = await runSession([
      event("user.message", 0, { content: text("Hi") }),
      idle(1, "retries_exhausted"),
    ]);
    expect(spanNamed(spans, "invoke_agent concierge").status.code).toBe(
      SpanStatusCode.ERROR,
    );
  });

  test("marks a tool call without a result failed when the turn fails", async () => {
    const { spans } = await runSession([
      event("user.message", 0, { content: text("Ask the specialist") }),
      event("agent.thread_message_sent", 1, {
        to_session_thread_id: "sthr_1",
        to_agent_name: "specialist",
        content: text("Search"),
      }),
      idle(2, "budget_reached"),
    ]);
    expect(spanNamed(spans, "execute_tool transfer_to_agent").status.code).toBe(
      SpanStatusCode.ERROR,
    );
  });

  test("traces a turn that the stream ends before it finishes", async () => {
    const { spans } = await runSession(toolTurn(), 4);
    expect(spanNamed(spans, "invoke_agent concierge").name).toBe(
      "invoke_agent concierge",
    );
  });

  test("traces nothing when a session only changes status", async () => {
    const { spans } = await runSession([idle(0)]);
    expect(spans).toEqual([]);
  });
});
