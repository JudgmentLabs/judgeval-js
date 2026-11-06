import { describe, expect, test } from "bun:test";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { AttributeKeys } from "../JudgmentAttributeKeys";
import type { ConversationObservation } from "../internal/api/models";
import { BaseTracer } from "./BaseTracer";
import type { JudgmentSpanExporter } from "./exporters/JudgmentSpanExporter";
import { NoOpSpanExporter } from "./exporters/NoOpSpanExporter";
import { JudgmentTracerProvider } from "./JudgmentTracerProvider";
import type { JudgmentSpanProcessor } from "./processors/JudgmentSpanProcessor";
import { NoOpSpanProcessor } from "./processors/NoOpSpanProcessor";

class FakeTracer extends BaseTracer {
  constructor(provider: BasicTracerProvider) {
    super(
      "test-project",
      "test-project-id",
      "test-key",
      "test-org",
      "https://example.com",
      null,
      // A serializer that is not JSON, to show the observation ignores it.
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

describe("BaseTracer.setConversationObservation", () => {
  test("writes the observation as JSON to the current span", () => {
    const exporter = new InMemorySpanExporter();
    const tracer = new FakeTracer(
      new BasicTracerProvider({
        spanProcessors: [new SimpleSpanProcessor(exporter)],
      }),
    );
    const proxy = JudgmentTracerProvider.getInstance();
    proxy.register(tracer);
    proxy.setActive(tracer);
    const observation: ConversationObservation = {
      model: "my-model-v2",
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "text", text: "Where is order 4812?" }],
        },
      ],
      output: [
        {
          type: "tool_call",
          call_id: "c1",
          name: "lookup_order",
          arguments: { id: 4812 },
        },
      ],
      usage: { output_tokens: 12 },
    };
    try {
      BaseTracer.span("reply", () => {
        BaseTracer.setConversationObservation(observation);
      });
      const span = exporter.getFinishedSpans().find((s) => s.name === "reply");
      const value =
        span?.attributes[AttributeKeys.JUDGMENT_CONVERSATION_OBSERVATION];
      expect(JSON.parse(String(value))).toEqual(observation);
    } finally {
      proxy.deregister(tracer);
    }
  });
});
