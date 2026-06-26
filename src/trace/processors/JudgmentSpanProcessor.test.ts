import { describe, expect, test } from "bun:test";
import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import { AttributeKeys } from "../../JudgmentAttributeKeys";
import { JudgmentSpanProcessor } from "./JudgmentSpanProcessor";

// The deterministic content of an exported span — everything except the
// inherently-random trace/span ids and wall-clock start time, which a
// fixed-value assertion can't pin down.
function spanContent(span: ReadableSpan) {
  return {
    name: span.name,
    kind: span.kind,
    status: span.status,
    attributes: span.attributes,
    events: span.events,
    links: span.links,
  };
}

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
    expect(spanContent(finished[0]!)).toEqual({
      name: "run",
      kind: SpanKind.INTERNAL,
      status: { code: SpanStatusCode.UNSET },
      // A partial of a span with no attributes set carries only the update id.
      attributes: { [AttributeKeys.JUDGMENT_UPDATE_ID]: 0 },
      events: [],
      links: [],
    });
    // A partial snapshot stamps end time to start time (zero duration).
    expect(finished[0]!.endTime).toEqual(finished[0]!.startTime);

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
    // The partial: no output, end stamped to start, update id 0.
    expect(spanContent(finished[0]!)).toEqual({
      name: "run",
      kind: SpanKind.INTERNAL,
      status: { code: SpanStatusCode.UNSET },
      attributes: { [AttributeKeys.JUDGMENT_UPDATE_ID]: 0 },
      events: [],
      links: [],
    });
    expect(finished[0]!.endTime).toEqual(finished[0]!.startTime);
    // The final: output added and the update id bumped.
    expect(spanContent(finished[1]!)).toEqual({
      name: "run",
      kind: SpanKind.INTERNAL,
      status: { code: SpanStatusCode.UNSET },
      attributes: {
        [AttributeKeys.JUDGMENT_OUTPUT]: "done",
        [AttributeKeys.JUDGMENT_UPDATE_ID]: 1,
      },
      events: [],
      links: [],
    });
  });
});
