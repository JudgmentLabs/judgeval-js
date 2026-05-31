import { describe, expect, test } from "bun:test";
import { SpanStatusCode, trace, type Span } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { AttributeKeys } from "../JudgmentAttributeKeys";
import { JudgmentTracerProvider } from "./JudgmentTracerProvider";
import { BaseTracer } from "./BaseTracer";
import { safeStringify } from "../utils/serializer";
import { NoOpSpanExporter } from "./exporters/NoOpSpanExporter";
import { NoOpSpanProcessor } from "./processors/NoOpSpanProcessor";
import {
  ALLOW_ALL_BAGGAGE_KEYS,
  JudgmentBaggageSpanProcessor,
} from "./processors/JudgmentBaggageSpanProcessor";
import type { JudgmentSpanExporter } from "./exporters/JudgmentSpanExporter";
import type { JudgmentSpanProcessor } from "./processors/JudgmentSpanProcessor";

class FakeTracer extends BaseTracer {
  constructor(
    provider: BasicTracerProvider,
    serializer: (v: unknown) => string = (v) => String(v),
  ) {
    super(
      "test-project",
      "test-project-id",
      "test-key",
      "test-org",
      "https://example.com",
      null,
      serializer,
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

function setupProxyWithBaggage(): {
  proxy: JudgmentTracerProvider;
  exporter: InMemorySpanExporter;
  cleanup: () => void;
} {
  const exporter = new InMemorySpanExporter();
  const sdkProvider = new BasicTracerProvider({
    spanProcessors: [
      new JudgmentBaggageSpanProcessor(ALLOW_ALL_BAGGAGE_KEYS),
      new SimpleSpanProcessor(exporter),
    ],
  });
  const tracer = new FakeTracer(sdkProvider, safeStringify);
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

describe("BaseTracer.scopedContext", () => {
  test("sets attributes on spans created inside scope", () => {
    const { exporter, cleanup } = setupProxyWithBaggage();
    try {
      BaseTracer.scopedContext(
        {
          sessionId: "FT-347",
          customerId: "firetiger",
          customerUserId: "user-123",
          attributes: { "firetiger.issue_number": "FT-347" },
        },
        () => {
          BaseTracer.startActiveSpan({ name: "inside" }, (span) => {
            span.end();
          });
        },
      );

      const span = exporter
        .getFinishedSpans()
        .find((s) => s.name === "inside");
      expect(span).toBeDefined();
      expect(span!.attributes[AttributeKeys.JUDGMENT_SESSION_ID]).toBe(
        "FT-347",
      );
      expect(span!.attributes[AttributeKeys.JUDGMENT_CUSTOMER_ID]).toBe(
        "firetiger",
      );
      expect(span!.attributes[AttributeKeys.JUDGMENT_CUSTOMER_USER_ID]).toBe(
        "user-123",
      );
      expect(span!.attributes["firetiger.issue_number"]).toBe("FT-347");
    } finally {
      cleanup();
    }
  });

  test("sets current active span and child span", () => {
    const { exporter, cleanup } = setupProxyWithBaggage();
    try {
      BaseTracer.startActiveSpan({ name: "root" }, (rootSpan) => {
        BaseTracer.scopedContext({ sessionId: "session-1" }, () => {
          BaseTracer.startActiveSpan({ name: "child" }, (childSpan) => {
            childSpan.end();
          });
        });
        rootSpan.end();
      });

      const root = exporter.getFinishedSpans().find((s) => s.name === "root");
      const child = exporter
        .getFinishedSpans()
        .find((s) => s.name === "child");
      expect(root!.attributes[AttributeKeys.JUDGMENT_SESSION_ID]).toBe(
        "session-1",
      );
      expect(child!.attributes[AttributeKeys.JUDGMENT_SESSION_ID]).toBe(
        "session-1",
      );
    } finally {
      cleanup();
    }
  });

  test("context does not leak after scope", () => {
    const { exporter, cleanup } = setupProxyWithBaggage();
    try {
      BaseTracer.scopedContext({ sessionId: "scoped" }, () => {
        BaseTracer.startActiveSpan({ name: "inside" }, (span) => {
          span.end();
        });
      });
      BaseTracer.startActiveSpan({ name: "outside" }, (span) => {
        span.end();
      });

      const inside = exporter
        .getFinishedSpans()
        .find((s) => s.name === "inside");
      const outside = exporter
        .getFinishedSpans()
        .find((s) => s.name === "outside");
      expect(inside!.attributes[AttributeKeys.JUDGMENT_SESSION_ID]).toBe(
        "scoped",
      );
      expect(
        outside!.attributes[AttributeKeys.JUDGMENT_SESSION_ID],
      ).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  test("nested context restores outer scope", () => {
    const { exporter, cleanup } = setupProxyWithBaggage();
    try {
      BaseTracer.scopedContext({ sessionId: "outer" }, () => {
        BaseTracer.startActiveSpan({ name: "outer-before" }, (span) => {
          span.end();
        });
        BaseTracer.scopedContext({ sessionId: "inner" }, () => {
          BaseTracer.startActiveSpan({ name: "inner" }, (span) => {
            span.end();
          });
        });
        BaseTracer.startActiveSpan({ name: "outer-after" }, (span) => {
          span.end();
        });
      });

      const spans = exporter.getFinishedSpans();
      const outerBefore = spans.find((s) => s.name === "outer-before");
      const inner = spans.find((s) => s.name === "inner");
      const outerAfter = spans.find((s) => s.name === "outer-after");
      expect(outerBefore!.attributes[AttributeKeys.JUDGMENT_SESSION_ID]).toBe(
        "outer",
      );
      expect(inner!.attributes[AttributeKeys.JUDGMENT_SESSION_ID]).toBe(
        "inner",
      );
      expect(outerAfter!.attributes[AttributeKeys.JUDGMENT_SESSION_ID]).toBe(
        "outer",
      );
    } finally {
      cleanup();
    }
  });

  test("context restores after exception", () => {
    const { exporter, cleanup } = setupProxyWithBaggage();
    try {
      try {
        BaseTracer.scopedContext({ sessionId: "scoped" }, () => {
          BaseTracer.startActiveSpan({ name: "inside" }, (span) => {
            span.end();
          });
          throw new Error("boom");
        });
      } catch {
        // expected
      }
      BaseTracer.startActiveSpan({ name: "outside" }, (span) => {
        span.end();
      });

      const inside = exporter
        .getFinishedSpans()
        .find((s) => s.name === "inside");
      const outside = exporter
        .getFinishedSpans()
        .find((s) => s.name === "outside");
      expect(inside!.attributes[AttributeKeys.JUDGMENT_SESSION_ID]).toBe(
        "scoped",
      );
      expect(
        outside!.attributes[AttributeKeys.JUDGMENT_SESSION_ID],
      ).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  test("arbitrary attributes are serialized and invalid entries skipped", () => {
    const { exporter, cleanup } = setupProxyWithBaggage();
    try {
      BaseTracer.scopedContext(
        {
          attributes: {
            payload: { issue: "FT-347" },
            count: 3,
            "": "skip-empty-key",
            "skip.none": null,
          } as Record<string, unknown>,
        },
        () => {
          BaseTracer.startActiveSpan({ name: "serialized" }, (span) => {
            span.end();
          });
        },
      );

      const span = exporter
        .getFinishedSpans()
        .find((s) => s.name === "serialized");
      expect(span!.attributes["payload"]).toBe('{"issue":"FT-347"}');
      expect(span!.attributes["count"]).toBe("3");
      expect(span!.attributes[""]).toBeUndefined();
      expect(span!.attributes["skip.none"]).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});
