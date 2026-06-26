import { describe, expect, test } from "bun:test";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { AttributeKeys } from "../../JudgmentAttributeKeys";
import { JudgmentSpanProcessor } from "./JudgmentSpanProcessor";

describe("JudgmentSpanProcessor.emitPartial", () => {
  test("snapshots an explicit span that is not the active span", async () => {
    const exporter = new InMemorySpanExporter();
    const processor = new JudgmentSpanProcessor(null, exporter);
    const provider = new BasicTracerProvider({ spanProcessors: [processor] });
    // Recording, but never made active (started, not start-active).
    const span = provider.getTracer("test").startSpan("run");

    processor.emitPartial(span);
    await processor.forceFlush();

    const finished = exporter.getFinishedSpans();
    expect(finished.length).toBe(1);
    expect(finished[0]?.name).toBe("run");
    // A partial snapshot stamps end time to the start time (zero duration)...
    expect(finished[0]?.endTime).toEqual(finished[0]!.startTime);
    // ...and carries the first update id so the backend can upgrade it later.
    expect(finished[0]?.attributes[AttributeKeys.JUDGMENT_UPDATE_ID]).toBe(0);

    span.end();
  });

  test("ending the span after a partial re-emits it with a higher update id", async () => {
    const exporter = new InMemorySpanExporter();
    const processor = new JudgmentSpanProcessor(null, exporter);
    const provider = new BasicTracerProvider({ spanProcessors: [processor] });
    const span = provider.getTracer("test").startSpan("run");

    processor.emitPartial(span); // update id 0 — input only, no output yet
    span.setAttribute(AttributeKeys.JUDGMENT_OUTPUT, "done");
    span.end(); // update id 1 — final, with output
    await processor.forceFlush();

    const finished = exporter.getFinishedSpans();
    expect(finished.length).toBe(2);
    expect(finished[0]?.attributes[AttributeKeys.JUDGMENT_UPDATE_ID]).toBe(0);
    expect(finished[0]?.attributes[AttributeKeys.JUDGMENT_OUTPUT]).toBeUndefined();
    expect(finished[1]?.attributes[AttributeKeys.JUDGMENT_UPDATE_ID]).toBe(1);
    expect(finished[1]?.attributes[AttributeKeys.JUDGMENT_OUTPUT]).toBe("done");
  });
});
