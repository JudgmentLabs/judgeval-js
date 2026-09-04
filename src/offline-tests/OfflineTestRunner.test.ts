import { describe, expect, spyOn, test } from "bun:test";
import { ExportResultCode } from "@opentelemetry/core";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import { JudgmentApiClient } from "../internal/api/client";
import { JudgmentSpanExporter } from "../trace/exporters/JudgmentSpanExporter";
import { JudgmentTracerProvider } from "../trace/JudgmentTracerProvider";
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

const provider = JudgmentTracerProvider.getInstance();
const registeredCount = (): number =>
  (provider as unknown as { _tracers: Set<unknown> })._tracers.size;

/**
 * Run `fn` with the real `OfflineTracer` made network-free: project lookup
 * and OTLP export are stubbed, and exported spans land in `spans`.
 */
async function withOfflineSpans(
  fn: (spans: ReadableSpan[]) => Promise<void>,
): Promise<void> {
  const spans: ReadableSpan[] = [];
  const resolveSpy = spyOn(
    JudgmentApiClient.prototype,
    "postV1projectsResolve",
  ).mockResolvedValue({ project_id: "proj-id" } as never);
  const exportSpy = spyOn(
    JudgmentSpanExporter.prototype,
    "export",
  ).mockImplementation((batch, cb) => {
    spans.push(...batch);
    cb({ code: ExportResultCode.SUCCESS });
  });
  try {
    await fn(spans);
  } finally {
    resolveSpy.mockRestore();
    exportSpy.mockRestore();
  }
}

describe("OfflineTestRunner.runAgent concurrency", () => {
  test("maps each example to the trace of its own call under concurrency", async () => {
    await withOfflineSpans(async () => {
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
    await withOfflineSpans(async () => {
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
    await withOfflineSpans(async () => {
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
    await withOfflineSpans(async () => {
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

  test("throws and cleans up when a live root span blocks activation", async () => {
    const liveTracer = await Tracer.init({
      spanProcessors: [new SimpleSpanProcessor(new InMemorySpanExporter())],
      setActive: true,
    });
    try {
      await withOfflineSpans(async () => {
        let calls = 0;
        const agent = (fields: Record<string, unknown>): unknown => {
          calls += 1;
          return fields.input;
        };
        const before = registeredCount();

        await Tracer.observe(async () => {
          await expect(
            makeRunner().runAgent(agent, makeExamples(2), 2),
          ).rejects.toThrow("could not be activated");
        })();

        expect(calls).toBe(0);
        expect(provider.getActiveTracer()).toBe(liveTracer);
        expect(registeredCount()).toBe(before);
      });
    } finally {
      provider.deregister(liveTracer);
      provider.restoreActive(null);
      await liveTracer._tracerProvider.shutdown();
    }
  });

  test("releases the offline tracer after a run", async () => {
    await withOfflineSpans(async () => {
      const before = registeredCount();
      const traces = await makeRunner().runAgent(
        // Nested observed call: only the root span maps to the example.
        (fields: Record<string, unknown>) =>
          Tracer.observe(() => fields.input, { spanName: "inner" })(),
        makeExamples(2),
        2,
      );
      expect(Object.keys(traces)).toHaveLength(2);
      expect(registeredCount()).toBe(before);
      expect(provider.getActiveTracer()).toBeNull();
    });
  });

  test("records judgment.input under the agent function's parameter name", async () => {
    await withOfflineSpans(async (spans) => {
      await makeRunner().runAgent(
        (myFields: Record<string, unknown>) => myFields.input,
        makeExamples(1),
        1,
      );

      const rootSpan = spans.find(
        (span) => span.parentSpanContext === undefined,
      );
      expect(rootSpan).toBeDefined();
      expect(
        JSON.parse(String(rootSpan?.attributes["judgment.input"])),
      ).toEqual({ myFields: { input: "q0" } });
    });
  });

  test("each concurrent trace records its own example's input under the agent's param name", async () => {
    await withOfflineSpans(async (spans) => {
      const traces = await makeRunner().runAgent(
        async (myFields: Record<string, unknown>) => {
          await new Promise((r) => setTimeout(r, Math.random() * 20));
          return myFields.input;
        },
        makeExamples(4),
        4,
      );

      const roots = spans.filter(
        (span) => span.parentSpanContext === undefined,
      );
      expect(roots).toHaveLength(4);
      for (let i = 0; i < 4; i += 1) {
        const root = roots.find(
          (span) => span.spanContext().traceId === traces[`ex-${i}`],
        );
        expect(JSON.parse(String(root?.attributes["judgment.input"]))).toEqual({
          myFields: { input: `q${i}` },
        });
      }
    });
  });

  test("skips examples without an id", async () => {
    await withOfflineSpans(async () => {
      const traces = await makeRunner().runAgent(
        (fields: Record<string, unknown>) => fields.input,
        [
          {
            exampleId: "",
            data: { input: "q" },
            offlineTraceId: null,
            createdAt: null,
          },
        ],
        1,
      );
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

  test("restores the previously active tracer and keeps its traces isolated", async () => {
    const liveExporter = new InMemorySpanExporter();
    const liveTracer = await Tracer.init({
      spanProcessors: [new SimpleSpanProcessor(liveExporter)],
      setActive: true,
    });
    try {
      await withOfflineSpans(async (offlineSpans) => {
        const traces = await makeRunner().runAgent(
          (fields: Record<string, unknown>) => fields.input,
          makeExamples(2),
          2,
        );

        expect(provider.getActiveTracer()).toBe(liveTracer);
        // Agent spans went to the offline tracer only.
        expect(liveExporter.getFinishedSpans()).toHaveLength(0);
        expect(offlineSpans).toHaveLength(2);

        await Tracer.observe((x: string) => x, { spanName: "live-after" })(
          "hi",
        );

        const liveSpans = liveExporter.getFinishedSpans();
        expect(liveSpans.map((s) => s.name)).toEqual(["live-after"]);
        expect(Object.values(traces)).not.toContain(
          liveSpans[0]!.spanContext().traceId,
        );
      });
    } finally {
      provider.deregister(liveTracer);
      provider.restoreActive(null);
      await liveTracer._tracerProvider.shutdown();
    }
  });
});
