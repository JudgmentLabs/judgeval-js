import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { context } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { isTracingSuppressed } from "@opentelemetry/core";
import { BatchObservationProcessor } from "./BatchObservationProcessor";
import type {
  ObservationExporter,
  SentObservation,
} from "./ObservationExporter";

/** Records each exported batch and whether tracing was suppressed. */
function recordingExporter() {
  const batches: SentObservation[][] = [];
  const suppressed: boolean[] = [];
  const exporter = {
    export: (batch: SentObservation[]) => {
      suppressed.push(isTracingSuppressed(context.active()));
      batches.push(batch);
      return Promise.resolve();
    },
  };
  return {
    exporter: exporter as unknown as ObservationExporter,
    batches,
    suppressed,
  };
}

function item(index: number): SentObservation {
  return {
    observation: { conversation_id: String(index), input: [] },
    observed_at: "2026-11-11T00:00:00.000Z",
  };
}

// OpenTelemetry carries context only through a registered context manager.
// An app whose instrumentation could record the export's request has one.
beforeAll(() => {
  context.setGlobalContextManager(
    new AsyncLocalStorageContextManager().enable(),
  );
});
afterAll(() => context.disable());

describe("BatchObservationProcessor", () => {
  test("flush exports everything in batches of at most one hundred", async () => {
    const recorded = recordingExporter();
    const processor = new BatchObservationProcessor(recorded.exporter);
    for (let index = 0; index < 250; index++) processor.emit(item(index));
    await processor.forceFlush();
    expect(recorded.batches.flat().length).toBe(250);
    expect(Math.max(...recorded.batches.map((batch) => batch.length))).toBe(
      100,
    );
  });

  test("exports with tracing suppressed", async () => {
    const recorded = recordingExporter();
    const processor = new BatchObservationProcessor(recorded.exporter);
    processor.emit(item(0));
    await processor.forceFlush();
    expect(recorded.suppressed).toEqual([true]);
  });

  test("shutdown exports the queue and ignores later observations", async () => {
    const recorded = recordingExporter();
    const processor = new BatchObservationProcessor(recorded.exporter);
    processor.emit(item(0));
    await processor.shutdown();
    processor.emit(item(1));
    await processor.forceFlush();
    expect(recorded.batches).toEqual([[item(0)]]);
  });
});
