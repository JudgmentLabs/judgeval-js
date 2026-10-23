import { describe, expect, test } from "bun:test";
import { SpanStatusCode, trace, type Span } from "@opentelemetry/api";
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
    return new NoOpSpanExporter();
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

describe("restoreActive", () => {
  test("puts back a previous tracer or clears the active one", () => {
    const { proxy, cleanup } = setupProxy();
    try {
      const previous = proxy.getActiveTracer();
      proxy.restoreActive(null);
      expect(proxy.getActiveTracer()).toBeNull();
      proxy.restoreActive(previous);
      expect(proxy.getActiveTracer()).toBe(previous);
    } finally {
      cleanup();
    }
  });
});

describe("concurrent observed traces", () => {
  test("concurrent observed calls emit isolated, independent traces", async () => {
    const { proxy, exporter, cleanup } = setupProxy();
    try {
      const currentTraceId = (): string =>
        trace.getSpan(proxy.getCurrentContext())!.spanContext().traceId;
      const runOne = BaseTracer.observe(
        async (label: string) => {
          const traceId = currentTraceId();
          // Randomize completion order to force interleaving.
          await new Promise((r) => setTimeout(r, Math.random() * 20));
          BaseTracer.observe(() => currentTraceId(), {
            spanName: `child-${label}`,
          })();
          // The await must not leak a sibling call's context.
          expect(currentTraceId()).toBe(traceId);
          return { label, traceId };
        },
        { spanName: "root" },
      );

      const results = await Promise.all(
        ["a", "b", "c", "d"].map((label) => runOne(label)),
      );
      expect(new Set(results.map((r) => r.traceId)).size).toBe(4);

      const finished = exporter.getFinishedSpans();
      const roots = finished.filter((s) => s.parentSpanContext === undefined);
      const children = finished.filter((s) => s.name.startsWith("child-"));
      expect(roots.length).toBe(4);
      expect(children.length).toBe(4);
      for (const child of children) {
        const label = child.name.slice("child-".length);
        const traceId = results.find((r) => r.label === label)!.traceId;
        const root = roots.find((s) => s.spanContext().traceId === traceId)!;
        expect(root).toBeDefined();
        expect(child.spanContext().traceId).toBe(traceId);
        expect(child.parentSpanContext?.spanId).toBe(root.spanContext().spanId);
      }
    } finally {
      cleanup();
    }
  });
});

describe("BaseTracer.startActiveSpan span lifecycle", () => {
  test("ends the span on synchronous return", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const result = BaseTracer.span("sync-ok", () => 42);
      expect(result).toBe(42);
      expect(exporter.getFinishedSpans().length).toBe(1);
    } finally {
      cleanup();
    }
  });

  test("ends the span on async resolve", async () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const result = await BaseTracer.span("async-ok", () =>
        Promise.resolve(42),
      );
      expect(result).toBe(42);
      expect(exporter.getFinishedSpans().length).toBe(1);
    } finally {
      cleanup();
    }
  });

  test("ends the span on synchronous throw and propagates the error", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      let caught: Error | undefined;
      try {
        BaseTracer.span("sync-throw", () => {
          throw new Error("boom-sync");
        });
      } catch (e) {
        caught = e as Error;
      }
      expect(caught?.message).toBe("boom-sync");
      const finished = exporter.getFinishedSpans();
      expect(finished.length).toBe(1);
      expect(finished[0]?.status.code).toBe(SpanStatusCode.ERROR);
      expect(finished[0]?.events.some((e) => e.name === "exception")).toBe(
        true,
      );
    } finally {
      cleanup();
    }
  });

  test("ends the span on async reject and propagates the error", async () => {
    const { exporter, cleanup } = setupProxy();
    try {
      let caught: Error | undefined;
      try {
        await BaseTracer.span("async-reject", () =>
          Promise.reject(new Error("boom-async")),
        );
      } catch (e) {
        caught = e as Error;
      }
      expect(caught?.message).toBe("boom-async");
      const finished = exporter.getFinishedSpans();
      expect(finished.length).toBe(1);
      expect(finished[0]?.status.code).toBe(SpanStatusCode.ERROR);
      expect(finished[0]?.events.some((e) => e.name === "exception")).toBe(
        true,
      );
    } finally {
      cleanup();
    }
  });
});

describe("JudgmentTracerProvider.setActive root-span guard", () => {
  test("blocks activation while a root span is recording", () => {
    const { proxy, cleanup } = setupProxy();
    const other = new FakeTracer(new BasicTracerProvider());
    try {
      const otelTracer = proxy.getTracer("test");
      let result: boolean | undefined;
      otelTracer.startActiveSpan("root-span", (span) => {
        result = proxy.setActive(other);
        span.end();
      });
      expect(result).toBe(false);
    } finally {
      proxy.deregister(other);
      cleanup();
    }
  });

  test("allows activation while only a child span is recording", () => {
    const { proxy, cleanup } = setupProxy();
    const previous = proxy.getActiveTracer();
    const other = new FakeTracer(new BasicTracerProvider());
    try {
      const otelTracer = proxy.getTracer("test");
      let result: boolean | undefined;
      otelTracer.startActiveSpan("root-span", (root) => {
        otelTracer.startActiveSpan("child-span", (child) => {
          result = proxy.setActive(other);
          child.end();
        });
        root.end();
      });
      expect(result).toBe(true);
    } finally {
      proxy.deregister(other);
      if (previous) proxy.setActive(previous);
      cleanup();
    }
  });
});
