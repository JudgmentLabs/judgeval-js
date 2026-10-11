import { describe, expect, spyOn, test } from "bun:test";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { JudgmentTracerProvider } from "./JudgmentTracerProvider";
import { BaseTracer } from "./BaseTracer";
import { JudgmentBaggageSpanProcessor } from "./processors/JudgmentBaggageSpanProcessor";
import { NoOpSpanExporter } from "./exporters/NoOpSpanExporter";
import { NoOpSpanProcessor } from "./processors/NoOpSpanProcessor";
import { Logger } from "../utils/logger";
import { AttributeKeys } from "../JudgmentAttributeKeys";
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
  // Wire the baggage processor so propagating attributes land on child spans,
  // mirroring the real tracer pipeline.
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

describe("BaseTracer.setPropagatingAttribute", () => {
  test("sets the attribute on the current span", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      BaseTracer.span("surface", () => {
        BaseTracer.setPropagatingAttribute("luna.surface", "slack");
      });
      const span = exporter
        .getFinishedSpans()
        .find((s) => s.name === "surface");
      expect(span?.attributes["luna.surface"]).toBe("slack");
    } finally {
      cleanup();
    }
  });

  test("propagates the attribute to child spans via baggage", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      BaseTracer.span("root", () => {
        BaseTracer.setPropagatingAttribute("luna.surface", "platform");
        BaseTracer.span("child", () => {});
      });
      const child = exporter.getFinishedSpans().find((s) => s.name === "child");
      expect(child?.attributes["luna.surface"]).toBe("platform");
    } finally {
      cleanup();
    }
  });

  test("rejects keys using the reserved judgment. prefix", () => {
    const { exporter, cleanup } = setupProxy();
    const errorSpy = spyOn(Logger, "error");
    try {
      BaseTracer.span("reserved", () => {
        BaseTracer.setPropagatingAttribute(
          AttributeKeys.JUDGMENT_CUSTOMER_ID,
          "evil",
        );
      });
      const span = exporter
        .getFinishedSpans()
        .find((s) => s.name === "reserved");
      expect(span?.attributes[AttributeKeys.JUDGMENT_CUSTOMER_ID]).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
      cleanup();
    }
  });
});

describe("BaseTracer.testCase", () => {
  const RUN = AttributeKeys.JUDGMENT_TEST_RUN_ID;
  const CASE = AttributeKeys.JUDGMENT_TEST_CASE_ID;

  test("tags the root and its children without leaking", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      BaseTracer.testCase("run-1", "case-1", () => {
        BaseTracer.span("root", () => {
          BaseTracer.span("child", () => {});
        });
      });
      BaseTracer.span("outside", () => {});

      const spans = new Map(
        exporter.getFinishedSpans().map((s) => [s.name, s]),
      );
      expect(spans.get("root")?.parentSpanContext).toBeUndefined();
      for (const name of ["root", "child"]) {
        expect(spans.get(name)?.attributes[RUN]).toBe("run-1");
        expect(spans.get(name)?.attributes[CASE]).toBe("case-1");
      }
      expect(spans.get("outside")?.attributes[RUN]).toBeUndefined();
      expect(spans.get("outside")?.attributes[CASE]).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  test("tags the current span", () => {
    const { exporter, cleanup } = setupProxy();
    try {
      BaseTracer.span("agent", () => {
        BaseTracer.testCase("run-1", "case-1", () => {});
      });
      const span = exporter.getFinishedSpans().find((s) => s.name === "agent");
      expect(span?.attributes[RUN]).toBe("run-1");
      expect(span?.attributes[CASE]).toBe("case-1");
    } finally {
      cleanup();
    }
  });

  test("keeps concurrent cases isolated", async () => {
    const { exporter, cleanup } = setupProxy();
    const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
    try {
      await Promise.all(
        [0, 1, 2, 3, 4].map((i) =>
          BaseTracer.testCase("run-1", `case-${i}`, () =>
            BaseTracer.span(`root-${i}`, async () => {
              await tick();
              await BaseTracer.span(`child-${i}`, tick);
            }),
          ),
        ),
      );

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(10);
      for (const span of spans) {
        expect(span.attributes[RUN]).toBe("run-1");
        expect(span.attributes[CASE]).toBe(`case-${span.name.split("-")[1]}`);
      }
    } finally {
      cleanup();
    }
  });
});
