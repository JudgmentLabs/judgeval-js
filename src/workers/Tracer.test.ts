import { afterEach, describe, expect, test } from "bun:test";
import { Tracer, type JudgmentSpanProcessorConfig } from "./index";
import { WorkerTracerProvider } from "./WorkerTracerProvider";

const originalFetch = globalThis.fetch;

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await WorkerTracerProvider.getInstance().shutdown();
});

function timeoutAfter(milliseconds: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error("timed out waiting for span export"));
    }, milliseconds);
  });
}

describe("Workers Tracer span processor configuration", () => {
  test("forwards batch settings to JudgmentSpanProcessor", async () => {
    let markExported = (): void => {};
    const exported = new Promise<void>((resolve) => {
      markExported = resolve;
    });
    globalThis.fetch = Object.assign(
      () => {
        markExported();
        return Promise.resolve(new Response(null, { status: 200 }));
      },
      { preconnect: originalFetch.preconnect },
    );

    const spanProcessorConfig: JudgmentSpanProcessorConfig = {
      maxQueueSize: 1,
      maxExportBatchSize: 1,
      scheduledDelayMillis: 60_000,
    };
    const tracer = await Tracer.init({
      apiKey: "test-api-key",
      organizationId: "test-organization-id",
      projectId: "test-project-id",
      apiUrl: "https://example.com",
      setActive: false,
      spanProcessorConfig,
    });

    const span = tracer._tracerProvider.getTracer("test").startSpan("test");
    span.end();

    await expect(
      Promise.race([exported, timeoutAfter(1_000)]),
    ).resolves.toBeUndefined();
  });
});
