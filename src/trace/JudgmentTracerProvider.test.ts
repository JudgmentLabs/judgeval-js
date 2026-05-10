import { describe, expect, test } from "bun:test";
import { trace, type Span } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { JudgmentTracerProvider } from "./JudgmentTracerProvider";
import { BaseTracer } from "./BaseTracer";
import { NoOpSpanExporter } from "./exporters/NoOpSpanExporter";
import { NoOpSpanProcessor } from "./processors/NoOpSpanProcessor";
import type { JudgmentSpanExporter } from "./exporters/JudgmentSpanExporter";
import type { JudgmentSpanProcessor } from "./processors/JudgmentSpanProcessor";

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
    return new NoOpSpanExporter() as unknown as JudgmentSpanExporter;
  }
}

function setupProxy(): {
  proxy: JudgmentTracerProvider;
  exporter: InMemorySpanExporter;
  cleanup: () => void;
} {
  const exporter = new InMemorySpanExporter();
  const sdkProvider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  const tracer = new FakeTracer(sdkProvider);
  const proxy = JudgmentTracerProvider.getInstance();
  proxy.register(tracer);
  proxy.setActive(tracer);
  return {
    proxy,
    exporter,
    cleanup: () => {
      proxy.deregister(tracer);
    },
  };
}

describe("ProxyTracer.startActiveSpan", () => {
  test("does not end the span when the callback returns", () => {
    const { proxy, exporter, cleanup } = setupProxy();
    try {
      const otelTracer = proxy.getTracer("test");
      let captured: Span | undefined;
      otelTracer.startActiveSpan("test-span", (span) => {
        captured = span;
      });
      expect(captured).toBeDefined();
      expect(exporter.getFinishedSpans().length).toBe(0);
      captured?.end();
      expect(exporter.getFinishedSpans().length).toBe(1);
    } finally {
      cleanup();
    }
  });

  test("does not end the span when an async callback resolves", async () => {
    const { proxy, exporter, cleanup } = setupProxy();
    try {
      const otelTracer = proxy.getTracer("test");
      const span = await otelTracer.startActiveSpan(
        "async-span",
        async (span) => {
          await Promise.resolve();
          return span;
        },
      );
      expect(exporter.getFinishedSpans().length).toBe(0);
      span.end();
      expect(exporter.getFinishedSpans().length).toBe(1);
    } finally {
      cleanup();
    }
  });

  test("makes the span active during the callback", () => {
    const { proxy, cleanup } = setupProxy();
    try {
      const otelTracer = proxy.getTracer("test");
      otelTracer.startActiveSpan("active-span", (span) => {
        const active = trace.getSpan(proxy.getCurrentContext());
        expect(active).toBe(span);
        span.end();
      });
    } finally {
      cleanup();
    }
  });

  test("supports the AI SDK pattern of ending the span after the callback returns", async () => {
    const { proxy, exporter, cleanup } = setupProxy();
    try {
      const otelTracer = proxy.getTracer("test");
      const rootSpan = otelTracer.startActiveSpan(
        "ai.streamText",
        (span) => span,
      );
      expect(exporter.getFinishedSpans().length).toBe(0);
      await Promise.resolve();
      rootSpan.setAttribute("ai.usage.inputTokens", 13);
      rootSpan.setAttribute("ai.usage.outputTokens", 12);
      rootSpan.end();
      const finished = exporter.getFinishedSpans();
      expect(finished.length).toBe(1);
      expect(finished[0]?.attributes["ai.usage.inputTokens"]).toBe(13);
      expect(finished[0]?.attributes["ai.usage.outputTokens"]).toBe(12);
    } finally {
      cleanup();
    }
  });
});
