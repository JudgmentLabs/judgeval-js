import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Anthropic } from "@anthropic-ai/sdk";
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

/** A client backed by the real SDK that serves `events` as the session's stream. */
function clientServing(events: WireEvent[]): Anthropic {
  return new Anthropic({
    apiKey: "test",
    maxRetries: 0,
    fetch: () =>
      Promise.resolve(
        new Response(toSse(events), {
          headers: { "content-type": "text/event-stream" },
        }),
      ),
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

function recorded(span: ReadableSpan, key: string): unknown {
  return JSON.parse(String(span.attributes[key]));
}

const isUser = (item: unknown) =>
  String((item as WireEvent).type).startsWith("user.");

describe("wrapAnthropicManagedAgents", () => {
  test("passes the stream's events through", async () => {
    const events = toolTurn();
    const { received } = await runSession(events);
    expect(received).toEqual(events);
  });

  test("exports a turn as one span", async () => {
    const { spans } = await runSession(toolTurn());
    expect(spans.map((span) => span.name)).toEqual([
      "ANTHROPIC_MANAGED_AGENTS_TURN",
    ]);
  });

  test("records the user's events as the span input", async () => {
    const { received, spans } = await runSession(toolTurn());
    expect(recorded(spans[0], AttributeKeys.JUDGMENT_INPUT)).toEqual(
      received.filter(isUser),
    );
  });

  test("records the other events as the span output", async () => {
    const { received, spans } = await runSession(toolTurn());
    expect(recorded(spans[0], AttributeKeys.JUDGMENT_OUTPUT)).toEqual(
      received.filter((item) => !isUser(item)),
    );
  });

  test("spans from the first to the last event", async () => {
    const { spans } = await runSession(toolTurn());
    expect(spans[0].duration).toEqual([4, 100000000]);
  });

  test("nests the span under the active span", async () => {
    const spans = await BaseTracer.with("app", async () => {
      return (await runSession(toolTurn())).spans;
    });
    expect(
      spanNamed(spans, "ANTHROPIC_MANAGED_AGENTS_TURN").parentSpanContext
        ?.spanId,
    ).toBe(spanNamed(exporter.getFinishedSpans(), "app").spanContext().spanId);
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
    expect(spans).toHaveLength(1);
  });

  test("exports each turn of a session as its own trace", async () => {
    const { spans } = await runSession([...toolTurn(0), ...toolTurn(10)]);
    expect(new Set(spans.map((span) => span.spanContext().traceId)).size).toBe(
      2,
    );
  });

  test("keeps events from sub-agent threads as they are", async () => {
    const { received, spans } = await runSession([
      event("user.message", 0, { content: text("Ask the specialist") }),
      event("agent.custom_tool_use", 2, {
        id: "tool_1",
        name: "search",
        input: {},
        session_thread_id: "sthr_1",
      }),
      idle(5.1),
    ]);
    expect(recorded(spans[0], AttributeKeys.JUDGMENT_OUTPUT)).toEqual(
      received.filter((item) => !isUser(item)),
    );
  });

  test("exports a turn that the stream ends before it finishes", async () => {
    const { spans } = await runSession(toolTurn(), 4);
    expect(spans).toHaveLength(1);
  });

  test("exports nothing when a session only changes status", async () => {
    const { spans } = await runSession([idle(0)]);
    expect(spans).toEqual([]);
  });
});
