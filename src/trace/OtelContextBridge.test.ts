import { describe, expect, test } from "bun:test";
import { context, trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { AttributeKeys } from "../JudgmentAttributeKeys";
import { BaseTracer } from "./BaseTracer";
import { JudgmentTracerProvider } from "./JudgmentTracerProvider";
import { getBaggage } from "./baggage";
import { NoOpSpanExporter } from "./exporters/NoOpSpanExporter";
import { JudgmentBaggageSpanProcessor } from "./processors/JudgmentBaggageSpanProcessor";
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

function setupProxy() {
  const exporter = new InMemorySpanExporter();
  const sdkProvider = new BasicTracerProvider({
    spanProcessors: [
      new JudgmentBaggageSpanProcessor(),
      new SimpleSpanProcessor(exporter),
    ],
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

const byName = (exporter: InMemorySpanExporter, name: string) =>
  exporter.getFinishedSpans().find((s) => s.name === name);

describe("OpenTelemetry context bridge", () => {
  test("context.active() carries baggage set after the span started", () => {
    const { cleanup } = setupProxy();
    try {
      const seen = BaseTracer.span("root", () => {
        BaseTracer.setSessionId("session-1");
        return getBaggage(context.active())?.getEntry(
          AttributeKeys.JUDGMENT_SESSION_ID,
        )?.value;
      });
      expect(seen).toBe("session-1");
    } finally {
      cleanup();
    }
  });

  test("a span built from context.active() inherits the session", () => {
    const { proxy, exporter, cleanup } = setupProxy();
    try {
      BaseTracer.span("root", () => {
        BaseTracer.setSessionId("session-1");
        BaseTracer.setCustomerId("customer-1");
        BaseTracer.setCustomerUserId("user-1");
        const otelTracer = proxy.getTracer("third-party");
        const outer = otelTracer.startSpan("outer");
        const outerContext = trace.setSpan(context.active(), outer);
        otelTracer.startSpan("inner", {}, outerContext).end();
        outer.end();
      });
      expect(byName(exporter, "inner")?.attributes).toMatchObject({
        [AttributeKeys.JUDGMENT_SESSION_ID]: "session-1",
        [AttributeKeys.JUDGMENT_CUSTOMER_ID]: "customer-1",
        [AttributeKeys.JUDGMENT_CUSTOMER_USER_ID]: "user-1",
      });
    } finally {
      cleanup();
    }
  });

  test("context.with from third-party code sets the Judgment context", () => {
    const { proxy, exporter, cleanup } = setupProxy();
    try {
      let outerSpanId = "";
      BaseTracer.span("root", () => {
        const outer = proxy.getTracer("third-party").startSpan("outer");
        outerSpanId = outer.spanContext().spanId;
        context.with(trace.setSpan(context.active(), outer), () => {
          BaseTracer.span("inner", () => {});
        });
        outer.end();
      });
      expect(byName(exporter, "inner")?.parentSpanContext?.spanId).toBe(
        outerSpanId,
      );
    } finally {
      cleanup();
    }
  });

  test("baggage set inside context.with is visible to later Judgment spans", () => {
    const { proxy, exporter, cleanup } = setupProxy();
    try {
      BaseTracer.span("root", () => {
        const outer = proxy.getTracer("third-party").startSpan("outer");
        context.with(trace.setSpan(context.active(), outer), () => {
          BaseTracer.setSessionId("session-2");
          BaseTracer.span("inner", () => {});
        });
        outer.end();
      });
      expect(
        byName(exporter, "inner")?.attributes[
          AttributeKeys.JUDGMENT_SESSION_ID
        ],
      ).toBe("session-2");
    } finally {
      cleanup();
    }
  });

  test("context.bind captures the Judgment context", () => {
    const { proxy, exporter, cleanup } = setupProxy();
    try {
      let outerSpanId = "";
      let bound: () => void = () => {};
      BaseTracer.span("root", () => {
        const outer = proxy.getTracer("third-party").startSpan("outer");
        outerSpanId = outer.spanContext().spanId;
        bound = context.bind(trace.setSpan(context.active(), outer), () => {
          BaseTracer.span("inner", () => {});
        });
        outer.end();
      });
      bound();
      expect(byName(exporter, "inner")?.parentSpanContext?.spanId).toBe(
        outerSpanId,
      );
    } finally {
      cleanup();
    }
  });

  test("async continuations keep the context set by third-party code", async () => {
    const { proxy, exporter, cleanup } = setupProxy();
    try {
      let outerSpanId = "";
      await BaseTracer.span("root", async () => {
        const outer = proxy.getTracer("third-party").startSpan("outer");
        outerSpanId = outer.spanContext().spanId;
        await context.with(trace.setSpan(context.active(), outer), async () => {
          await Promise.resolve();
          BaseTracer.span("inner", () => {});
        });
        outer.end();
      });
      expect(byName(exporter, "inner")?.parentSpanContext?.spanId).toBe(
        outerSpanId,
      );
    } finally {
      cleanup();
    }
  });

  test("the Judgment context is not exposed outside a Judgment span", () => {
    const { proxy, cleanup } = setupProxy();
    try {
      BaseTracer.span("root", () => {});
      expect(trace.getSpan(context.active())).toBeUndefined();
      expect(trace.getSpan(proxy.getCurrentContext())).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});
