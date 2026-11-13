import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Agent, type AgentTool } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import { streamSimple } from "@earendil-works/pi-ai/compat";
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
import { wrapPi } from "./index";

type Json = Record<string, unknown>;

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

const tools: AgentTool[] = [
  {
    name: "weather",
    label: "Weather",
    description: "Current weather in a city",
    parameters: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
    },
    execute: () =>
      Promise.resolve({
        content: [{ type: "text", text: "Sunny" }],
        details: undefined,
      }),
  },
  {
    name: "explode",
    label: "Explode",
    description: "Always fails",
    parameters: { type: "object", properties: {} },
    execute: () => Promise.reject(new Error("boom")),
  },
];

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/**
 * Serves each request to `path` with the next response's events as an SSE
 * stream, recording the request bodies it receives.
 */
function mockProvider(
  path: string,
  responses: string[][],
): { url: string; requests: unknown[]; stop: () => void } {
  const requests: unknown[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (new URL(request.url).pathname !== path) {
        return new Response("not found", { status: 404 });
      }
      requests.push(await request.json());
      const events = responses[requests.length - 1];
      if (!events)
        return Response.json({ error: "overloaded" }, { status: 500 });
      return new Response(events.join(""), {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  return { url: server.url.origin, requests, stop: () => server.stop(true) };
}

/** An SSE event, named by its type as Anthropic and Responses streams are. */
function sse(data: Json | string): string {
  if (typeof data === "string") return `data: ${data}\n\n`;
  const name = typeof data.type === "string" ? `event: ${data.type}\n` : "";
  return `${name}data: ${JSON.stringify(data)}\n\n`;
}

/** The SSE events that stream one Anthropic content block. */
function contentBlock(
  index: number,
  block: Json,
  deltas: Json[] = [],
): string[] {
  return [
    sse({ type: "content_block_start", index, content_block: block }),
    ...deltas.map((delta) =>
      sse({ type: "content_block_delta", index, delta }),
    ),
    sse({ type: "content_block_stop", index }),
  ];
}

function model<A extends Api>(
  api: A,
  provider: string,
  baseUrl: string,
): Model<A> {
  return {
    id: "test-model",
    name: "Test model",
    api,
    provider,
    baseUrl,
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200_000,
    maxTokens: 8_192,
  };
}

/**
 * Runs an agent that is shown an image, calls a tool that answers and one that
 * throws, then answers in text. Returns the request bodies the agent's own
 * `onPayload` saw and the spans that were recorded.
 */
async function runAgent(
  agentModel: Model<Api>,
): Promise<{ payloads: unknown[]; spans: ReadableSpan[] }> {
  const payloads: unknown[] = [];
  const agent = new Agent({
    initialState: {
      systemPrompt: "You are a weather bot.",
      model: agentModel,
      thinkingLevel: "high",
      tools,
    },
    streamFn: wrapPi(streamSimple),
    getApiKey: () => "sk-fake",
    sessionId: "session-1",
    onPayload: (payload) => {
      payloads.push(payload);
      return undefined;
    },
  });
  await agent.prompt("What is this, and how is the weather in Paris?", [
    { type: "image", data: PNG, mimeType: "image/png" },
  ]);
  // Spans end once pi settles each call's result, just after the run.
  await new Promise((resolve) => setTimeout(resolve, 10));
  await processor.forceFlush();
  const spans = exporter
    .getFinishedSpans()
    .filter((span) => span.name === "PI_API_CALL");
  return { payloads, spans };
}

function output(span: ReadableSpan | undefined): unknown {
  const value = span?.attributes[AttributeKeys.JUDGMENT_OUTPUT];
  return typeof value === "string" ? JSON.parse(value) : value;
}

/** Each span's input is the exact request body pi built for that call. */
function expectRecordedRequests(
  spans: ReadableSpan[],
  payloads: unknown[],
): void {
  expect(
    spans.map((span) => span.attributes[AttributeKeys.JUDGMENT_INPUT]),
  ).toEqual(payloads.map((payload) => JSON.stringify(payload)));
}

describe("wrapPi", () => {
  test("records Anthropic requests and the assembled Messages", async () => {
    const toolUseMessage = {
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "test-model",
      content: [] as Json[],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 20, output_tokens: 1, cache_read_input_tokens: 5 },
    };
    const provider = mockProvider("/v1/messages", [
      [
        sse({ type: "message_start", message: toolUseMessage }),
        ...contentBlock(0, { type: "thinking", thinking: "", signature: "" }, [
          { type: "thinking_delta", thinking: "Check " },
          { type: "thinking_delta", thinking: "Paris." },
          { type: "signature_delta", signature: "sig" },
        ]),
        ...contentBlock(1, { type: "redacted_thinking", data: "opaque" }),
        ...contentBlock(
          2,
          { type: "tool_use", id: "toolu_1", name: "weather", input: {} },
          [
            { type: "input_json_delta", partial_json: '{"city":' },
            { type: "input_json_delta", partial_json: '"Paris"}' },
          ],
        ),
        ...contentBlock(3, {
          type: "tool_use",
          id: "toolu_2",
          name: "explode",
          input: {},
        }),
        sse({
          type: "message_delta",
          delta: { stop_reason: "tool_use", stop_sequence: null },
          usage: { output_tokens: 42 },
        }),
        sse({ type: "message_stop" }),
      ],
      [
        sse({
          type: "message_start",
          message: { ...toolUseMessage, id: "msg_2" },
        }),
        ...contentBlock(0, { type: "text", text: "" }, [
          { type: "text_delta", text: "A pixel. " },
          { type: "text_delta", text: "Paris is sunny." },
        ]),
        sse({
          type: "message_delta",
          delta: { stop_reason: "end_turn", stop_sequence: null },
          usage: { output_tokens: 7 },
        }),
        sse({ type: "message_stop" }),
      ],
    ]);
    try {
      const { payloads, spans } = await runAgent(
        model("anthropic-messages", "anthropic", provider.url),
      );

      expectRecordedRequests(spans, payloads);
      expect(spans.map(output)).toEqual([
        {
          ...toolUseMessage,
          content: [
            { type: "thinking", thinking: "Check Paris.", signature: "sig" },
            { type: "redacted_thinking", data: "opaque" },
            {
              type: "tool_use",
              id: "toolu_1",
              name: "weather",
              input: { city: "Paris" },
            },
            { type: "tool_use", id: "toolu_2", name: "explode", input: {} },
          ],
          stop_reason: "tool_use",
          usage: { ...toolUseMessage.usage, output_tokens: 42 },
        },
        {
          ...toolUseMessage,
          id: "msg_2",
          content: [{ type: "text", text: "A pixel. Paris is sunny." }],
          stop_reason: "end_turn",
          usage: { ...toolUseMessage.usage, output_tokens: 7 },
        },
      ]);
      // The request pi sent is the one recorded; the SDK moves `betas` to a header.
      expect(provider.requests).toEqual(
        payloads.map((payload) => {
          const { betas: _betas, ...body } = payload as Json;
          return body;
        }),
      );
      expect(spans[0]?.attributes).toMatchObject({
        [AttributeKeys.JUDGMENT_SPAN_KIND]: "llm",
        [AttributeKeys.JUDGMENT_SESSION_ID]: "session-1",
        [AttributeKeys.JUDGMENT_LLM_PROVIDER]: "anthropic",
        [AttributeKeys.JUDGMENT_LLM_MODEL_NAME]: "test-model",
        [AttributeKeys.JUDGMENT_USAGE_NON_CACHED_INPUT_TOKENS]: 20,
        [AttributeKeys.JUDGMENT_USAGE_CACHE_READ_INPUT_TOKENS]: 5,
        [AttributeKeys.JUDGMENT_USAGE_OUTPUT_TOKENS]: 42,
      });
    } finally {
      provider.stop();
    }
  });

  test("records Chat Completions requests and the assembled completions", async () => {
    const chunk = {
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 1,
      model: "test-model",
    };
    const call = (index: number, fields: Json) =>
      sse({
        ...chunk,
        choices: [{ index: 0, delta: { tool_calls: [{ index, ...fields }] } }],
      });
    const provider = mockProvider("/v1/chat/completions", [
      [
        sse({
          ...chunk,
          choices: [
            {
              index: 0,
              delta: {
                role: "assistant",
                content: null,
                reasoning_content: "Check ",
              },
            },
          ],
        }),
        sse({
          ...chunk,
          choices: [{ index: 0, delta: { reasoning_content: "Paris." } }],
        }),
        call(0, {
          id: "call_1",
          type: "function",
          function: { name: "weather", arguments: "" },
        }),
        call(0, { function: { arguments: '{"city":"Paris"}' } }),
        call(1, {
          id: "call_2",
          type: "function",
          function: { name: "explode", arguments: "{}" },
        }),
        sse({
          ...chunk,
          choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
        }),
        sse({
          ...chunk,
          choices: [],
          usage: {
            prompt_tokens: 30,
            completion_tokens: 12,
            total_tokens: 42,
            prompt_tokens_details: { cached_tokens: 10 },
          },
        }),
        sse("[DONE]"),
      ],
      [
        sse({
          ...chunk,
          id: "chatcmpl-2",
          choices: [
            { index: 0, delta: { role: "assistant", content: "Paris " } },
          ],
        }),
        sse({
          ...chunk,
          id: "chatcmpl-2",
          choices: [
            {
              index: 0,
              delta: { content: "is sunny." },
              finish_reason: "stop",
            },
          ],
        }),
        sse("[DONE]"),
      ],
    ]);
    try {
      const { payloads, spans } = await runAgent(
        model("openai-completions", "openai", `${provider.url}/v1`),
      );

      expectRecordedRequests(spans, payloads);
      expect(spans.map(output)).toEqual([
        {
          ...chunk,
          object: "chat.completion",
          choices: [
            {
              index: 0,
              finish_reason: "tool_calls",
              logprobs: null,
              message: {
                role: "assistant",
                content: null,
                refusal: null,
                reasoning_content: "Check Paris.",
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: {
                      name: "weather",
                      arguments: '{"city":"Paris"}',
                    },
                  },
                  {
                    id: "call_2",
                    type: "function",
                    function: { name: "explode", arguments: "{}" },
                  },
                ],
              },
            },
          ],
          usage: {
            prompt_tokens: 30,
            completion_tokens: 12,
            total_tokens: 42,
            prompt_tokens_details: { cached_tokens: 10 },
          },
        },
        {
          ...chunk,
          id: "chatcmpl-2",
          object: "chat.completion",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              logprobs: null,
              message: {
                role: "assistant",
                content: "Paris is sunny.",
                refusal: null,
              },
            },
          ],
        },
      ]);
      expect(provider.requests).toEqual(payloads);
      expect(spans[0]?.attributes).toMatchObject({
        [AttributeKeys.JUDGMENT_USAGE_NON_CACHED_INPUT_TOKENS]: 20,
        [AttributeKeys.JUDGMENT_USAGE_CACHE_READ_INPUT_TOKENS]: 10,
        [AttributeKeys.JUDGMENT_USAGE_OUTPUT_TOKENS]: 12,
      });
    } finally {
      provider.stop();
    }
  });

  test("records Responses requests and the final Response objects", async () => {
    const usage = {
      input_tokens: 30,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 12,
      output_tokens_details: { reasoning_tokens: 4 },
      total_tokens: 42,
    };
    const functionCall = (id: string, name: string, args: string) => ({
      type: "function_call",
      id: `fc_${id}`,
      call_id: `call_${id}`,
      name,
      arguments: args,
      status: "completed",
    });
    const toolCallResponse = {
      id: "resp_1",
      object: "response",
      status: "completed",
      model: "test-model",
      output: [
        {
          type: "reasoning",
          id: "rs_1",
          summary: [{ type: "summary_text", text: "Check Paris." }],
          encrypted_content: "enc",
        },
        functionCall("1", "weather", '{"city":"Paris"}'),
        functionCall("2", "explode", "{}"),
      ],
      usage,
    };
    const answer = {
      ...toolCallResponse,
      id: "resp_2",
      output: [
        {
          type: "message",
          id: "msg_1",
          role: "assistant",
          status: "completed",
          content: [
            { type: "output_text", text: "Paris is sunny.", annotations: [] },
          ],
        },
      ],
    };
    /** Streams a response's output items, then the completed response. */
    const stream = (response: { output: Json[] }) => [
      sse({
        type: "response.created",
        sequence_number: 0,
        response: { ...response, status: "in_progress", output: [] },
      }),
      ...response.output.map((item, index) =>
        sse({
          type: "response.output_item.done",
          sequence_number: index + 1,
          output_index: index,
          item,
        }),
      ),
      sse({ type: "response.completed", sequence_number: 9, response }),
    ];
    const provider = mockProvider("/v1/responses", [
      stream(toolCallResponse),
      stream(answer),
    ]);
    try {
      const { payloads, spans } = await runAgent(
        model("openai-responses", "openai", `${provider.url}/v1`),
      );

      expectRecordedRequests(spans, payloads);
      expect(spans.map(output)).toEqual([toolCallResponse, answer]);
      expect(provider.requests).toEqual(payloads);
    } finally {
      provider.stop();
    }
  });

  test("records a failed request's error without an output", async () => {
    const provider = mockProvider("/v1/chat/completions", []);
    try {
      const { payloads, spans } = await runAgent(
        model("openai-completions", "openai", `${provider.url}/v1`),
      );

      expectRecordedRequests(spans, payloads);
      expect(spans.map((span) => span.status.code)).toEqual([
        SpanStatusCode.ERROR,
      ]);
      expect(
        spans[0]?.attributes[AttributeKeys.JUDGMENT_OUTPUT],
      ).toBeUndefined();
    } finally {
      provider.stop();
    }
  });
});
