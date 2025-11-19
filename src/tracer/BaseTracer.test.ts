/* eslint-disable @typescript-eslint/no-empty-function */
import { context, SpanStatusCode, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  type ReadableSpan,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { JudgmentApiClient } from "../internal/api";
import { BaseTracer } from "./BaseTracer";

class TestTracer extends BaseTracer {
  initialize(): Promise<void> {
    return Promise.resolve();
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

describe("BaseTracer - Span Linking and Context Propagation", () => {
  let tracer: TestTracer;
  let mockApiClient: JudgmentApiClient;
  let provider: BasicTracerProvider;
  let exporter: InMemorySpanExporter;

  beforeEach(() => {
    const contextManager = new AsyncLocalStorageContextManager();
    contextManager.enable();
    context.setGlobalContextManager(contextManager);

    exporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    trace.setGlobalTracerProvider(provider);

    mockApiClient = {
      getOrganizationId: () => "test-org",
      getBaseUrl: () => "https://test.example.com",
      getApiKey: () => "test-key",
    } as JudgmentApiClient;

    tracer = Reflect.construct(TestTracer, [
      "test-project",
      false,
      mockApiClient,
      JSON.stringify,
    ]) as TestTracer;

    tracer.getTracer = () => provider.getTracer(BaseTracer.TRACER_NAME);
  });

  afterEach(async () => {
    await provider.forceFlush();
    exporter.reset();
    context.disable();
  });

  async function getSpans(): Promise<ReadableSpan[]> {
    await provider.forceFlush();
    return exporter.getFinishedSpans();
  }

  async function findSpanByName(
    name: string
  ): Promise<ReadableSpan | undefined> {
    const spans = await getSpans();
    return spans.find((s) => s.name === name);
  }

  describe("span() - manual spans without auto-linking", () => {
    test("simple parent-child with startActiveSpan", async () => {
      const testTracer = provider.getTracer("test");

      testTracer.startActiveSpan("parent", (parentSpan) => {
        testTracer.startActiveSpan("child", (childSpan) => {
          childSpan.end();
        });
        parentSpan.end();
      });

      const spans = await getSpans();
      const parent = spans.find((s) => s.name === "parent");
      const child = spans.find((s) => s.name === "child");

      expect(parent).toBeDefined();
      expect(child).toBeDefined();
      expect(child?.spanContext().traceId).toBe(parent?.spanContext().traceId);
      expect(child?.parentSpanContext?.spanId).toBe(
        parent?.spanContext().spanId
      );
    });

    test("manual span created inside with() DOES auto-link", async () => {
      tracer.with("parent", () => {
        const manualSpan = tracer.span("manual-child");
        manualSpan.end();
      });

      const spans = await getSpans();
      expect(spans.length).toBe(2);

      const parent = await findSpanByName("parent");
      const child = await findSpanByName("manual-child");

      expect(parent).toBeDefined();
      expect(child).toBeDefined();
      expect(child?.parentSpanContext?.spanId).toBe(
        parent?.spanContext().spanId
      );
    });

    test("manual span links to parent when wrapped in context.with", async () => {
      const manualParent = tracer.span("manual-parent");

      context.with(trace.setSpan(context.active(), manualParent), () => {
        tracer.with("auto-child", () => {});
      });

      manualParent.end();

      const spans = await getSpans();
      expect(spans.length).toBe(2);

      const parent = await findSpanByName("manual-parent");
      const child = await findSpanByName("auto-child");

      expect(parent).toBeDefined();
      expect(child).toBeDefined();
      expect(child?.parentSpanContext?.spanId).toBe(
        parent?.spanContext().spanId
      );
    });

    test("nested manual spans with explicit context management properly link", async () => {
      const span1 = tracer.span("manual-1");

      context.with(trace.setSpan(context.active(), span1), () => {
        const span2 = tracer.span("manual-2");

        context.with(trace.setSpan(context.active(), span2), () => {
          const span3 = tracer.span("manual-3");
          span3.end();
        });

        span2.end();
      });

      span1.end();

      const spans = await getSpans();
      expect(spans.length).toBe(3);

      const s1 = await findSpanByName("manual-1");
      const s2 = await findSpanByName("manual-2");
      const s3 = await findSpanByName("manual-3");

      expect(s1?.parentSpanContext?.spanId).toBeUndefined();
      expect(s2?.parentSpanContext?.spanId).toBe(s1?.spanContext().spanId);
      expect(s3?.parentSpanContext?.spanId).toBe(s2?.spanContext().spanId);
    });
  });

  describe("with() - automatic span lifecycle and linking", () => {
    test("creates root span when no parent context exists", async () => {
      tracer.with("root", () => {});

      const spans = await getSpans();
      expect(spans.length).toBe(1);
      expect(spans[0].name).toBe("root");
      expect(spans[0].parentSpanContext?.spanId).toBeUndefined();
    });

    test("child span auto-links to parent", async () => {
      tracer.with("parent", () => {
        tracer.with("child", () => {});
      });

      const spans = await getSpans();
      expect(spans.length).toBe(2);

      const parent = await findSpanByName("parent");
      const child = await findSpanByName("child");

      expect(child?.parentSpanContext?.spanId).toBe(
        parent?.spanContext().spanId
      );
    });

    test("deeply nested spans maintain correct hierarchy", async () => {
      tracer.with("level-1", () => {
        tracer.with("level-2", () => {
          tracer.with("level-3", () => {});
        });
      });

      const spans = await getSpans();
      expect(spans.length).toBe(3);

      const l1 = await findSpanByName("level-1");
      const l2 = await findSpanByName("level-2");
      const l3 = await findSpanByName("level-3");

      expect(l1?.parentSpanContext?.spanId).toBeUndefined();
      expect(l2?.parentSpanContext?.spanId).toBe(l1?.spanContext().spanId);
      expect(l3?.parentSpanContext?.spanId).toBe(l2?.spanContext().spanId);
    });

    test("sibling spans share same parent", async () => {
      tracer.with("parent", () => {
        tracer.with("child-1", () => {});
        tracer.with("child-2", () => {});
      });

      const spans = await getSpans();
      expect(spans.length).toBe(3);

      const parent = await findSpanByName("parent");
      const child1 = await findSpanByName("child-1");
      const child2 = await findSpanByName("child-2");

      expect(child1?.parentSpanContext?.spanId).toBe(
        parent?.spanContext().spanId
      );
      expect(child2?.parentSpanContext?.spanId).toBe(
        parent?.spanContext().spanId
      );
    });

    test("async operations maintain context correctly", async () => {
      await tracer.with("async-parent", async () => {
        await tracer.with("async-child", async () => {
          await Promise.resolve();
        });
      });

      const spans = await getSpans();
      expect(spans.length).toBe(2);

      const parent = await findSpanByName("async-parent");
      const child = await findSpanByName("async-child");

      expect(child?.parentSpanContext?.spanId).toBe(
        parent?.spanContext().spanId
      );
    });

    test("parallel async spans maintain correct context", async () => {
      await tracer.with("parent", async () => {
        await Promise.all([
          tracer.with("parallel-1", async () => {
            await Promise.resolve();
          }),
          tracer.with("parallel-2", async () => {
            await Promise.resolve();
          }),
        ]);
      });

      const spans = await getSpans();
      expect(spans.length).toBe(3);

      const parent = await findSpanByName("parent");
      const p1 = await findSpanByName("parallel-1");
      const p2 = await findSpanByName("parallel-2");

      expect(p1?.parentSpanContext?.spanId).toBe(parent?.spanContext().spanId);
      expect(p2?.parentSpanContext?.spanId).toBe(parent?.spanContext().spanId);
    });

    test("records error status and exception on failure", async () => {
      try {
        void tracer.with("error-span", () => {
          throw new Error("test error");
        });
      } catch {
        // Expected error
      }

      const spans = await getSpans();
      expect(spans.length).toBe(1);
      expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
      expect(spans[0].events.length).toBeGreaterThan(0);
      expect(spans[0].events[0].name).toBe("exception");
    });

    test("async error handling maintains context", async () => {
      try {
        await tracer.with("parent", async () => {
          await tracer.with("child-error", async () => {
            await Promise.resolve();
            throw new Error("child error");
          });
        });
      } catch {
        // Expected error
      }

      const spans = await getSpans();
      expect(spans.length).toBe(2);

      const parent = await findSpanByName("parent");
      const child = await findSpanByName("child-error");

      expect(child?.parentSpanContext?.spanId).toBe(
        parent?.spanContext().spanId
      );
      expect(child?.status.code).toBe(SpanStatusCode.ERROR);
    });
  });

  describe("observe() - function wrapping with auto-linking", () => {
    test("creates root span when called without parent context", async () => {
      const func = () => 42;
      const wrapped = tracer.observe(func, "span", "observed-root");

      wrapped();

      const spans = await getSpans();
      expect(spans.length).toBe(1);
      expect(spans[0].name).toBe("observed-root");
      expect(spans[0].parentSpanContext?.spanId).toBeUndefined();
    });

    test("observed function auto-links to active parent", async () => {
      const func = () => "result";
      const wrapped = tracer.observe(func, "span", "observed-child");

      tracer.with("parent", () => {
        wrapped();
      });

      const spans = await getSpans();
      expect(spans.length).toBe(2);

      const parent = await findSpanByName("parent");
      const child = await findSpanByName("observed-child");

      expect(child?.parentSpanContext?.spanId).toBe(
        parent?.spanContext().spanId
      );
    });

    test("nested observed calls maintain hierarchy", async () => {
      const inner = (x: number) => x * 2;
      const outer = (x: number) => wrappedInner(x) + 1;

      const wrappedInner = tracer.observe(inner, "span", "inner");
      const wrappedOuter = tracer.observe(outer, "span", "outer");

      wrappedOuter(5);

      const spans = await getSpans();
      expect(spans.length).toBe(2);

      const outerSpan = await findSpanByName("outer");
      const innerSpan = await findSpanByName("inner");

      expect(innerSpan?.parentSpanContext?.spanId).toBe(
        outerSpan?.spanContext().spanId
      );
    });

    test("async observed functions maintain context", async () => {
      const asyncFunc = async (n: number) => {
        await Promise.resolve();
        return n * 2;
      };

      const wrapped = tracer.observe(asyncFunc, "span", "async-observed");

      await tracer.with("parent", async () => {
        await wrapped(5);
      });

      const spans = await getSpans();
      expect(spans.length).toBe(2);

      const parent = await findSpanByName("parent");
      const child = await findSpanByName("async-observed");

      expect(child?.parentSpanContext?.spanId).toBe(
        parent?.spanContext().spanId
      );
    });

    test("multiple invocations create separate spans with same parent", async () => {
      const func = () => Math.random();
      const wrapped = tracer.observe(func, "span", "multi-call");

      tracer.with("parent", () => {
        wrapped();
        wrapped();
        wrapped();
      });

      const spans = await getSpans();
      expect(spans.length).toBe(4);

      const parent = await findSpanByName("parent");
      const children = spans.filter((s) => s.name === "multi-call");

      expect(children.length).toBe(3);
      children.forEach((child) => {
        expect(child.parentSpanContext?.spanId).toBe(
          parent?.spanContext().spanId
        );
      });
    });
  });

  describe("complex integration scenarios", () => {
    test("span() + with() + observe() mixed correctly", async () => {
      const manualSpan = tracer.span("manual-root");

      context.with(trace.setSpan(context.active(), manualSpan), () => {
        tracer.with("with-child", () => {
          const func = () => "result";
          const wrapped = tracer.observe(func, "span", "observe-grandchild");
          wrapped();
        });
      });

      manualSpan.end();

      const spans = await getSpans();
      expect(spans.length).toBe(3);

      const root = await findSpanByName("manual-root");
      const child = await findSpanByName("with-child");
      const grandchild = await findSpanByName("observe-grandchild");

      expect(child?.parentSpanContext?.spanId).toBe(root?.spanContext().spanId);
      expect(grandchild?.parentSpanContext?.spanId).toBe(
        child?.spanContext().spanId
      );
    });

    test("with() inside observe() inside with() maintains hierarchy", async () => {
      const func = () => {
        return tracer.with("inner-with", () => "nested");
      };

      const wrapped = tracer.observe(func, "span", "middle-observe");

      tracer.with("outer-with", () => {
        wrapped();
      });

      const spans = await getSpans();
      expect(spans.length).toBe(3);

      const outer = await findSpanByName("outer-with");
      const middle = await findSpanByName("middle-observe");
      const inner = await findSpanByName("inner-with");

      expect(middle?.parentSpanContext?.spanId).toBe(
        outer?.spanContext().spanId
      );
      expect(inner?.parentSpanContext?.spanId).toBe(
        middle?.spanContext().spanId
      );
    });

    test("error in nested context maintains span hierarchy", async () => {
      try {
        await tracer.with("root", async () => {
          await tracer.with("middle", async () => {
            await tracer.with("error-leaf", async () => {
              await Promise.resolve();
              throw new Error("nested error");
            });
          });
        });
      } catch {
        // Expected error
      }

      const spans = await getSpans();
      expect(spans.length).toBe(3);

      const root = await findSpanByName("root");
      const middle = await findSpanByName("middle");
      const leaf = await findSpanByName("error-leaf");

      expect(middle?.parentSpanContext?.spanId).toBe(
        root?.spanContext().spanId
      );
      expect(leaf?.parentSpanContext?.spanId).toBe(
        middle?.spanContext().spanId
      );
      expect(leaf?.status.code).toBe(SpanStatusCode.ERROR);
    });
  });

  describe("span attributes and metadata", () => {
    test("with() allows setting custom attributes", async () => {
      tracer.with("custom-attrs", (span) => {
        span.setAttribute("custom.key", "value");
        span.setAttribute("custom.number", 42);
      });

      await getSpans();
      const span = await findSpanByName("custom-attrs");

      expect(span?.attributes["custom.key"]).toBe("value");
      expect(span?.attributes["custom.number"]).toBe(42);
    });

    test("observe() captures input and output", async () => {
      const func = (a: number, b: number) => a + b;
      const wrapped = tracer.observe(func, "span", "math-add");

      wrapped(5, 10);

      const span = await findSpanByName("math-add");

      expect(span?.attributes["judgment.input"]).toBeDefined();
      expect(span?.attributes["judgment.output"]).toBe("15");
    });

    test("observe() sets span kind attribute", async () => {
      const func = () => "llm response";
      const wrapped = tracer.observe(func, "llm", "llm-call");

      wrapped();

      const span = await findSpanByName("llm-call");

      expect(span?.attributes["judgment.span_kind"]).toBe("llm");
    });
  });
});
