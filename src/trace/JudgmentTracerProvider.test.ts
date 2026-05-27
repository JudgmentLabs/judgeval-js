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

describe("BaseTracer.observe with generators", () => {
  test("sync generator: span stays open during iteration, records yielded values as output", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const gen = BaseTracer.observe(function* count(n: number) {
        for (let i = 1; i <= n; i++) yield i;
      });

      const iter = gen(3);

      // Span should NOT be finished yet — iteration hasn't started
      expect(exporter.getFinishedSpans().length).toBe(0);

      const values = [];
      for (const v of iter) {
        // Span stays open while we iterate
        expect(exporter.getFinishedSpans().length).toBe(0);
        values.push(v);
      }

      // Now the span should be finished
      expect(values).toEqual([1, 2, 3]);
      const finished = exporter.getFinishedSpans();
      expect(finished.length).toBe(1);
      expect(finished[0]?.attributes["judgment.output"]).toBe("1,2,3");
      expect(finished[0]?.attributes["judgment.input"]).toBeDefined();
    } finally {
      cleanup();
    }
  });

  test("sync generator: records error when generator throws", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const gen = BaseTracer.observe(function* failing() {
        yield "ok";
        throw new Error("gen-boom");
      });

      let caught: Error | undefined;
      try {
        for (const _v of gen()) {
          // consume
        }
      } catch (e) {
        caught = e as Error;
      }

      expect(caught?.message).toBe("gen-boom");
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

  test("async generator: span stays open during iteration, records yielded values as output", async () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const gen = BaseTracer.observe(async function* asyncCount(n: number) {
        for (let i = 1; i <= n; i++) {
          await Promise.resolve();
          yield i;
        }
      });

      const iter = gen(3);

      // Span should NOT be finished yet
      expect(exporter.getFinishedSpans().length).toBe(0);

      const values = [];
      for await (const v of iter) {
        values.push(v);
      }

      expect(values).toEqual([1, 2, 3]);
      const finished = exporter.getFinishedSpans();
      expect(finished.length).toBe(1);
      expect(finished[0]?.attributes["judgment.output"]).toBe("1,2,3");
      expect(finished[0]?.attributes["judgment.input"]).toBeDefined();
    } finally {
      cleanup();
    }
  });

  test("async generator: records error when generator throws", async () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const gen = BaseTracer.observe(async function* asyncFailing() {
        yield "ok";
        await Promise.resolve();
        throw new Error("async-gen-boom");
      });

      let caught: Error | undefined;
      const values = [];
      try {
        for await (const v of gen()) {
          values.push(v);
        }
      } catch (e) {
        caught = e as Error;
      }

      expect(values).toEqual(["ok"]);
      expect(caught?.message).toBe("async-gen-boom");
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

  test("sync generator: span ends immediately when no values are yielded", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const gen = BaseTracer.observe(function* empty() {
        // yields nothing
      });

      const values = [...gen()];
      expect(values).toEqual([]);
      const finished = exporter.getFinishedSpans();
      expect(finished.length).toBe(1);
      expect(finished[0]?.attributes["judgment.output"]).toBe("");
    } finally {
      cleanup();
    }
  });

  test("sync generator: span ends when consumer breaks early", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const gen = BaseTracer.observe(function* count() {
        yield 1;
        yield 2;
        yield 3;
      });

      const values = [];
      for (const v of gen()) {
        values.push(v);
        if (v === 2) break;
      }

      expect(values).toEqual([1, 2]);
      const finished = exporter.getFinishedSpans();
      expect(finished.length).toBe(1);
      // Output records only the values that were yielded before break
      expect(finished[0]?.attributes["judgment.output"]).toBe("1,2");
    } finally {
      cleanup();
    }
  });

  test("async generator: span ends when consumer breaks early", async () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const gen = BaseTracer.observe(async function* asyncCount() {
        yield "a";
        yield "b";
        yield "c";
      });

      const values = [];
      for await (const v of gen()) {
        values.push(v);
        if (v === "b") break;
      }

      expect(values).toEqual(["a", "b"]);
      const finished = exporter.getFinishedSpans();
      expect(finished.length).toBe(1);
      expect(finished[0]?.attributes["judgment.output"]).toBe("a,b");
    } finally {
      cleanup();
    }
  });

  test("async generator: recordOutput=false skips output attribute", async () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const gen = BaseTracer.observe(
        async function* noOutput() {
          yield 1;
          yield 2;
        },
        { recordOutput: false },
      );

      const values = [];
      for await (const v of gen()) values.push(v);

      expect(values).toEqual([1, 2]);
      const finished = exporter.getFinishedSpans();
      expect(finished.length).toBe(1);
      expect(finished[0]?.attributes["judgment.output"]).toBeUndefined();
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
