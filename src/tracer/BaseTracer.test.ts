import { trace } from "@opentelemetry/api";
import { beforeAll, describe, expect, it } from "bun:test";
import { Judgeval, type NodeTracer } from "../index";

let tracer: NodeTracer;

beforeAll(async () => {
  const client = Judgeval.create();
  tracer = await client.nodeTracer.create({
    projectName: "base-tracer-test",
  });
});

describe("observe async generator", () => {
  it("preserves context across yields", async () => {
    const traceIds: string[] = [];

    // eslint-disable-next-line @typescript-eslint/require-await
    async function* myGenerator() {
      for (let i = 0; i < 3; i++) {
        const active = trace.getActiveSpan();
        traceIds.push(active?.spanContext().traceId ?? "none");
        yield i;
      }
    }

    const traced = tracer.observe(myGenerator, "span", "my-generator");

    await tracer.with("parent", async (parentSpan) => {
      const gen = traced();

      for await (const _ of gen) {
        /* empty */
      }

      expect(traceIds.length).toBe(3);
      expect(
        traceIds.every((id) => id === parentSpan.spanContext().traceId),
      ).toBe(true);
    });
  });

  it("allows creating child spans inside generator", async () => {
    const childTraceIds: string[] = [];

    async function* orchestrator() {
      for (let i = 0; i < 2; i++) {
        // eslint-disable-next-line @typescript-eslint/await-thenable, @typescript-eslint/no-confusing-void-expression
        await tracer.with(`step-${i}`, (span) => {
          childTraceIds.push(span.spanContext().traceId);
        });
        yield { step: i };
      }
    }

    const traced = tracer.observe(orchestrator, "span", "orchestrator");

    await tracer.with("request", async (requestSpan) => {
      const gen = traced();

      for await (const _ of gen) {
        /* empty */
      }

      expect(childTraceIds.length).toBe(2);
      expect(
        childTraceIds.every((id) => id === requestSpan.spanContext().traceId),
      ).toBe(true);
    });
  });

  it("handles generator errors", async () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    async function* failingGenerator() {
      yield 1;
      throw new Error("generator error");
    }

    const traced = tracer.observe(failingGenerator, "span", "failing");

    let caught = false;
    try {
      const gen = traced();
      // eslint-disable-next-line no-empty
      for await (const _ of gen) {
      }
    } catch {
      caught = true;
    }

    expect(caught).toBe(true);
  });
});

describe("observe sync generator", () => {
  it("preserves context across yields", () => {
    const traceIds: string[] = [];

    function* myGenerator() {
      for (let i = 0; i < 3; i++) {
        const active = trace.getActiveSpan();
        traceIds.push(active?.spanContext().traceId ?? "none");
        yield i;
      }
    }

    const traced = tracer.observe(myGenerator, "span", "sync-generator");

    tracer.with("parent", (parentSpan) => {
      const gen = traced();

      // eslint-disable-next-line no-empty
      for (const _ of gen) {
      }

      expect(traceIds.length).toBe(3);
      expect(
        traceIds.every((id) => id === parentSpan.spanContext().traceId),
      ).toBe(true);
    });
  });

  it("allows creating child spans inside generator", () => {
    const childTraceIds: string[] = [];

    function* syncOrchestrator() {
      for (let i = 0; i < 2; i++) {
        tracer.with(`sync-step-${i}`, (span) => {
          childTraceIds.push(span.spanContext().traceId);
        });
        yield { step: i };
      }
    }

    const traced = tracer.observe(
      syncOrchestrator,
      "span",
      "sync-orchestrator",
    );

    tracer.with("request", (requestSpan) => {
      const gen = traced();

      // eslint-disable-next-line no-empty
      for (const _ of gen) {
      }

      expect(childTraceIds.length).toBe(2);
      expect(
        childTraceIds.every((id) => id === requestSpan.spanContext().traceId),
      ).toBe(true);
    });
  });

  it("handles generator errors", () => {
    function* failingGenerator() {
      yield 1;
      throw new Error("sync generator error");
    }

    const traced = tracer.observe(failingGenerator, "span", "sync-failing");

    let caught = false;
    try {
      const gen = traced();
      // eslint-disable-next-line no-empty
      for (const _ of gen) {
      }
    } catch {
      caught = true;
    }

    expect(caught).toBe(true);
  });
});
