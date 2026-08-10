import { describe, expect, test } from "bun:test";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { JudgmentTracerProvider } from "./JudgmentTracerProvider";
import { Tracer } from "./Tracer";

describe("Tracer.init span processors", () => {
  test("keeps user span processors when monitoring is disabled", async () => {
    const exporter = new InMemorySpanExporter();
    // No projectName: monitoring is disabled and no network call is made.
    const tracer = await Tracer.init({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
      setActive: false,
    });
    try {
      const span = tracer._tracerProvider.getTracer("test").startSpan("s");
      span.end();
      expect(exporter.getFinishedSpans()).toHaveLength(1);
      expect(exporter.getFinishedSpans()[0]?.name).toBe("s");
    } finally {
      JudgmentTracerProvider.getInstance().deregister(tracer);
      await tracer._tracerProvider.shutdown();
    }
  });
});
