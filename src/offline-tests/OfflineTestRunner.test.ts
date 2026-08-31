import { describe, expect, spyOn, test } from "bun:test";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import type { JudgmentApiClient } from "../internal/api/client";
import { JudgmentTracerProvider } from "../trace/JudgmentTracerProvider";
import { OfflineTracer } from "../trace/OfflineTracer";
import { Tracer } from "../trace/Tracer";
import { OfflineTestRunner } from "./OfflineTestRunner";

const fakeClient = {
  getApiKey: () => "key",
  getOrganizationId: () => "org",
  getBaseUrl: () => "http://localhost:9999",
} as unknown as JudgmentApiClient;

const makeRunner = (): OfflineTestRunner =>
  new OfflineTestRunner(fakeClient, "p1", "proj");

const makeExamples = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    exampleId: `ex-${i}`,
    data: { input: `q${i}` },
    offlineTraceId: null,
    createdAt: null,
  }));

/**
 * Stub `OfflineTracer.create` with a real (network-free) tracer exporting to
 * an in-memory exporter, so `runAgent` exercises the real observe/context
 * machinery. `activate: false` simulates a refused active-tracer swap.
 */
async function withStubbedOfflineTracer(
  activate: boolean,
  fn: (exporter: InMemorySpanExporter) => Promise<void>,
): Promise<void> {
  const exporter = new InMemorySpanExporter();
  // No projectName: monitoring is disabled and no network call is made.
  const tracer = await Tracer.init({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
    setActive: false,
  });
  const provider = JudgmentTracerProvider.getInstance();
  const createSpy = spyOn(OfflineTracer, "create").mockImplementation(() => {
    if (activate) provider.setActive(tracer);
    return Promise.resolve(tracer as unknown as OfflineTracer);
  });
  try {
    await fn(exporter);
  } finally {
    createSpy.mockRestore();
    provider.deregister(tracer);
    (provider as unknown as { _activeTracer: unknown })._activeTracer = null;
    await tracer._tracerProvider.shutdown();
  }
}

describe("OfflineTestRunner.runAgent concurrency", () => {
  test("maps each example to the trace of its own call under concurrency", async () => {
    await withStubbedOfflineTracer(true, async () => {
      const seen = new Map<string, string>();
      const agent = async (
        fields: Record<string, unknown>,
      ): Promise<unknown> => {
        seen.set(
          String(fields.input),
          Tracer.getCurrentSpan()!.spanContext().traceId,
        );
        // Randomize completion order to stress correlation.
        await new Promise((r) => setTimeout(r, Math.random() * 20));
        return fields.input;
      };

      const traces = await makeRunner().runAgent(agent, makeExamples(8), 4);

      expect(Object.keys(traces)).toHaveLength(8);
      expect(new Set(Object.values(traces)).size).toBe(8);
      for (let i = 0; i < 8; i += 1) {
        expect(traces[`ex-${i}`]).toBe(seen.get(`q${i}`)!);
      }
    });
  });

  test("runs examples concurrently", async () => {
    await withStubbedOfflineTracer(true, async () => {
      // The gate only opens once all 4 calls are in flight, so this test
      // deadlocks (and times out) if execution regresses to sequential.
      let entered = 0;
      let release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      const agent = async (): Promise<void> => {
        entered += 1;
        if (entered === 4) release();
        await gate;
      };

      const traces = await makeRunner().runAgent(agent, makeExamples(4), 4);
      expect(Object.keys(traces)).toHaveLength(4);
    });
  });

  test("default concurrency stays sequential and in dataset order", async () => {
    await withStubbedOfflineTracer(true, async () => {
      const calls: string[] = [];
      let inFlight = 0;
      let maxInFlight = 0;
      const agent = async (fields: Record<string, unknown>): Promise<void> => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        calls.push(String(fields.input));
        await new Promise((r) => setTimeout(r, 1));
        inFlight -= 1;
      };

      const traces = await makeRunner().runAgent(agent, makeExamples(4));

      expect(calls).toEqual(["q0", "q1", "q2", "q3"]);
      expect(maxInFlight).toBe(1);
      expect(Object.keys(traces)).toHaveLength(4);
    });
  });

  test("an agent error does not abort the remaining examples", async () => {
    await withStubbedOfflineTracer(true, async () => {
      // Sync agent: also covers the non-promise entrypoint path.
      const agent = (fields: Record<string, unknown>): unknown => {
        if (fields.input === "q1") throw new Error("boom");
        return fields.input;
      };

      const traces = await makeRunner().runAgent(agent, makeExamples(3), 2);

      // The failing example still produced (and exported) a trace; the
      // exception is recorded on it, matching prior behavior.
      expect(Object.keys(traces).sort()).toEqual(["ex-0", "ex-1", "ex-2"]);
    });
  });

  test("records no trace ids when the offline tracer failed to activate", async () => {
    await withStubbedOfflineTracer(false, async () => {
      const agent = (fields: Record<string, unknown>): unknown => fields.input;

      const traces = await makeRunner().runAgent(agent, makeExamples(2), 2);
      expect(traces).toEqual({});
    });
  });

  test("rejects concurrency below 1 or non-integer", async () => {
    const runner = makeRunner();
    const agent = (): void => {};
    await expect(runner.runAgent(agent, [], 0)).rejects.toThrow("concurrency");
    await expect(runner.runAgent(agent, [], 1.5)).rejects.toThrow(
      "concurrency",
    );
  });
});
