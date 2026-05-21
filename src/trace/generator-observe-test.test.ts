import { describe, expect, test } from "bun:test";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { BaseTracer } from "./BaseTracer";
import { JudgmentTracerProvider } from "./JudgmentTracerProvider";
import { NoOpSpanExporter } from "./exporters/NoOpSpanExporter";
import { NoOpSpanProcessor } from "./processors/NoOpSpanProcessor";
import type { JudgmentSpanExporter } from "./exporters/JudgmentSpanExporter";
import type { JudgmentSpanProcessor } from "./processors/JudgmentSpanProcessor";
import { AttributeKeys } from "../JudgmentAttributeKeys";

class FakeTracer extends BaseTracer {
  constructor(provider: BasicTracerProvider) {
    super(
      "test-project",
      "test-project-id",
      "test-key",
      "test-org",
      "https://example.com",
      null,
      (v) => JSON.stringify(v),
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

// ------------------------------------------------------------------ //
//  Test generators
// ------------------------------------------------------------------ //

function* generateNumbers(count: number): Generator<number> {
  for (let i = 0; i < count; i++) {
    yield i;
  }
}

async function* generateNumbersAsync(count: number): AsyncGenerator<number> {
  for (let i = 0; i < count; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1));
    yield i;
  }
}

async function* streamLLMResponse(_prompt: string): AsyncGenerator<string> {
  const chunks = ["Hello", ", ", "world", "!"];
  for (const chunk of chunks) {
    await new Promise((resolve) => setTimeout(resolve, 1));
    yield chunk;
  }
}

function* generateWithError(count: number): Generator<number> {
  for (let i = 0; i < count; i++) {
    if (i === 2) throw new Error("generator-sync-error");
    yield i;
  }
}

async function* generateWithErrorAsync(count: number): AsyncGenerator<number> {
  for (let i = 0; i < count; i++) {
    if (i === 2) throw new Error("generator-async-error");
    yield i;
  }
}

// ------------------------------------------------------------------ //
//  Sync generator tests
// ------------------------------------------------------------------ //

describe("Tracer.observe with sync generators", () => {
  test("span stays open until generator is fully consumed", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const observed = BaseTracer.observe(generateNumbers, {
        spanName: "sync-gen",
      });

      const gen = observed(3);

      // Span should NOT be finished yet — the generator hasn't been consumed
      expect(exporter.getFinishedSpans().length).toBe(0);

      const values: number[] = [];
      for (const value of gen) {
        values.push(value);
        // Span should still be open during iteration
        expect(exporter.getFinishedSpans().length).toBe(0);
      }

      // After full consumption, span should be finished
      expect(exporter.getFinishedSpans().length).toBe(1);
      expect(values).toEqual([0, 1, 2]);
    } finally {
      cleanup();
    }
  });

  test("output records all yielded values", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const observed = BaseTracer.observe(generateNumbers, {
        spanName: "sync-gen-output",
      });

      const values = [...observed(3)];
      expect(values).toEqual([0, 1, 2]);

      const span = exporter.getFinishedSpans()[0]!;
      const output = JSON.parse(
        span.attributes[AttributeKeys.JUDGMENT_OUTPUT] as string,
      );
      expect(output).toEqual([0, 1, 2]);
    } finally {
      cleanup();
    }
  });

  test("input is recorded correctly", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const observed = BaseTracer.observe(generateNumbers, {
        spanName: "sync-gen-input",
      });
      const _consume = [...observed(5)];

      const span = exporter.getFinishedSpans()[0]!;
      const input = JSON.parse(
        span.attributes[AttributeKeys.JUDGMENT_INPUT] as string,
      );
      expect(input).toEqual({ count: 5 });
    } finally {
      cleanup();
    }
  });

  test("error during iteration is recorded on span", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const observed = BaseTracer.observe(generateWithError, {
        spanName: "sync-gen-error",
      });

      const values: number[] = [];
      let caught: Error | undefined;
      try {
        for (const value of observed(5)) {
          values.push(value);
        }
      } catch (e) {
        caught = e as Error;
      }

      expect(caught?.message).toBe("generator-sync-error");
      expect(values).toEqual([0, 1]);

      const span = exporter.getFinishedSpans()[0]!;
      expect(span.status.code).toBe(2); // SpanStatusCode.ERROR
      expect(span.events.some((e) => e.name === "exception")).toBe(true);
    } finally {
      cleanup();
    }
  });

  test("early exit (break) ends the span with partial output", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const observed = BaseTracer.observe(generateNumbers, {
        spanName: "sync-gen-break",
      });

      const values: number[] = [];
      for (const value of observed(10)) {
        values.push(value);
        if (value === 2) break;
      }

      expect(values).toEqual([0, 1, 2]);
      expect(exporter.getFinishedSpans().length).toBe(1);

      const span = exporter.getFinishedSpans()[0]!;
      const output = JSON.parse(
        span.attributes[AttributeKeys.JUDGMENT_OUTPUT] as string,
      );
      expect(output).toEqual([0, 1, 2]);
    } finally {
      cleanup();
    }
  });

  test("recordOutput: false skips output recording", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const observed = BaseTracer.observe(generateNumbers, {
        spanName: "sync-gen-no-output",
        recordOutput: false,
      });
      const _consume = [...observed(3)];

      const span = exporter.getFinishedSpans()[0]!;
      expect(span.attributes[AttributeKeys.JUDGMENT_OUTPUT]).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});

// ------------------------------------------------------------------ //
//  Async generator tests
// ------------------------------------------------------------------ //

describe("Tracer.observe with async generators", () => {
  test("span stays open until async generator is fully consumed", async () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const observed = BaseTracer.observe(generateNumbersAsync, {
        spanName: "async-gen",
      });

      const gen = observed(3);

      // Span should NOT be finished yet
      expect(exporter.getFinishedSpans().length).toBe(0);

      const values: number[] = [];
      for await (const value of gen) {
        values.push(value);
        // Span should still be open during iteration
        expect(exporter.getFinishedSpans().length).toBe(0);
      }

      // After full consumption, span should be finished
      expect(exporter.getFinishedSpans().length).toBe(1);
      expect(values).toEqual([0, 1, 2]);
    } finally {
      cleanup();
    }
  });

  test("output records all yielded values", async () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const observed = BaseTracer.observe(generateNumbersAsync, {
        spanName: "async-gen-output",
      });

      const values: number[] = [];
      for await (const v of observed(3)) {
        values.push(v);
      }

      const span = exporter.getFinishedSpans()[0]!;
      const output = JSON.parse(
        span.attributes[AttributeKeys.JUDGMENT_OUTPUT] as string,
      );
      expect(output).toEqual([0, 1, 2]);
    } finally {
      cleanup();
    }
  });

  test("error during async iteration is recorded on span", async () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const observed = BaseTracer.observe(generateWithErrorAsync, {
        spanName: "async-gen-error",
      });

      const values: number[] = [];
      let caught: Error | undefined;
      try {
        for await (const value of observed(5)) {
          values.push(value);
        }
      } catch (e) {
        caught = e as Error;
      }

      expect(caught?.message).toBe("generator-async-error");
      expect(values).toEqual([0, 1]);

      const span = exporter.getFinishedSpans()[0]!;
      expect(span.status.code).toBe(2); // SpanStatusCode.ERROR
      expect(span.events.some((e) => e.name === "exception")).toBe(true);
    } finally {
      cleanup();
    }
  });

  test("early exit (break) ends the span with partial output", async () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const observed = BaseTracer.observe(generateNumbersAsync, {
        spanName: "async-gen-break",
      });

      const values: number[] = [];
      for await (const value of observed(10)) {
        values.push(value);
        if (value === 2) break;
      }

      expect(values).toEqual([0, 1, 2]);
      expect(exporter.getFinishedSpans().length).toBe(1);

      const span = exporter.getFinishedSpans()[0]!;
      const output = JSON.parse(
        span.attributes[AttributeKeys.JUDGMENT_OUTPUT] as string,
      );
      expect(output).toEqual([0, 1, 2]);
    } finally {
      cleanup();
    }
  });

  test("LLM streaming simulation records all chunks", async () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const observed = BaseTracer.observe(streamLLMResponse, {
        spanName: "llm-stream",
        spanType: "llm",
      });

      const chunks: string[] = [];
      for await (const chunk of observed("Say hello")) {
        chunks.push(chunk);
      }

      expect(chunks.join("")).toBe("Hello, world!");

      const span = exporter.getFinishedSpans()[0]!;
      const output = JSON.parse(
        span.attributes[AttributeKeys.JUDGMENT_OUTPUT] as string,
      );
      expect(output).toEqual(["Hello", ", ", "world", "!"]);
      expect(span.attributes[AttributeKeys.JUDGMENT_SPAN_KIND]).toBe("llm");
    } finally {
      cleanup();
    }
  });
});

// ------------------------------------------------------------------ //
//  Context propagation
// ------------------------------------------------------------------ //

describe("Context propagation with generators", () => {
  test("child spans inside async generator are parented correctly", async () => {
    const { exporter, cleanup } = setupProxy();
    try {
      // An async generator that creates a child span during each iteration
      async function* generatorWithChildSpans(
        count: number,
      ): AsyncGenerator<number> {
        for (let i = 0; i < count; i++) {
          await BaseTracer.span("child-work", async () => {
            await new Promise((resolve) => setTimeout(resolve, 1));
          });
          yield i;
        }
      }

      const observed = BaseTracer.observe(generatorWithChildSpans, {
        spanName: "parent-gen",
      });

      const values: number[] = [];
      for await (const value of observed(2)) {
        values.push(value);
      }

      expect(values).toEqual([0, 1]);

      const finished = exporter.getFinishedSpans();
      // Should have 3 spans: parent-gen + 2 child-work spans
      expect(finished.length).toBe(3);

      const parentSpan = finished.find((s) => s.name === "parent-gen")!;
      const childSpans = finished.filter((s) => s.name === "child-work");
      expect(childSpans.length).toBe(2);

      // Child spans should be in the same trace as the parent
      for (const child of childSpans) {
        expect(child.spanContext().traceId).toBe(
          parentSpan.spanContext().traceId,
        );
      }
    } finally {
      cleanup();
    }
  });

  test("nested observed generators maintain context hierarchy", async () => {
    const { exporter, cleanup } = setupProxy();
    try {
      async function* innerGen(label: string): AsyncGenerator<string> {
        yield `${label}-a`;
        yield `${label}-b`;
      }

      async function* outerGen(): AsyncGenerator<string> {
        const observedInner = BaseTracer.observe(innerGen, {
          spanName: "inner-gen",
        });
        for await (const v of observedInner("first")) {
          yield v;
        }
        for await (const v of observedInner("second")) {
          yield v;
        }
      }

      const observed = BaseTracer.observe(outerGen, {
        spanName: "outer-gen",
      });

      const values: string[] = [];
      for await (const v of observed()) {
        values.push(v);
      }

      expect(values).toEqual(["first-a", "first-b", "second-a", "second-b"]);

      const finished = exporter.getFinishedSpans();
      // Should have 3 spans: outer-gen + 2 inner-gen invocations
      expect(finished.length).toBe(3);

      const outerSpan = finished.find((s) => s.name === "outer-gen")!;
      const innerSpans = finished.filter((s) => s.name === "inner-gen");
      expect(innerSpans.length).toBe(2);

      // Inner spans should share the same trace as outer
      for (const inner of innerSpans) {
        expect(inner.spanContext().traceId).toBe(
          outerSpan.spanContext().traceId,
        );
      }
    } finally {
      cleanup();
    }
  });
});

// ------------------------------------------------------------------ //
//  BaseTracer.startActiveSpan / span with generators
// ------------------------------------------------------------------ //

describe("BaseTracer.startActiveSpan with generators", () => {
  test("keeps span open for sync generator", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const gen = BaseTracer.startActiveSpan(
        { name: "active-sync-gen" },
        (_span) => generateNumbers(3),
      );

      // Span should not be ended yet
      expect(exporter.getFinishedSpans().length).toBe(0);

      const values = [...gen];
      expect(values).toEqual([0, 1, 2]);

      // Now span should be ended
      expect(exporter.getFinishedSpans().length).toBe(1);
      expect(exporter.getFinishedSpans()[0]!.name).toBe("active-sync-gen");
    } finally {
      cleanup();
    }
  });

  test("keeps span open for async generator", async () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const gen = BaseTracer.startActiveSpan(
        { name: "active-async-gen" },
        (_span) => generateNumbersAsync(3),
      );

      expect(exporter.getFinishedSpans().length).toBe(0);

      const values: number[] = [];
      for await (const v of gen) {
        values.push(v);
      }
      expect(values).toEqual([0, 1, 2]);
      expect(exporter.getFinishedSpans().length).toBe(1);
    } finally {
      cleanup();
    }
  });
});

describe("BaseTracer.span with generators", () => {
  test("keeps span open for sync generator and records errors", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      const gen = BaseTracer.span("span-sync-gen", () => generateWithError(5));

      expect(exporter.getFinishedSpans().length).toBe(0);

      const values: number[] = [];
      let caught: Error | undefined;
      try {
        for (const v of gen) {
          values.push(v);
        }
      } catch (e) {
        caught = e as Error;
      }

      expect(caught?.message).toBe("generator-sync-error");
      expect(values).toEqual([0, 1]);
      expect(exporter.getFinishedSpans().length).toBe(1);
      expect(exporter.getFinishedSpans()[0]!.status.code).toBe(2);
    } finally {
      cleanup();
    }
  });
});
