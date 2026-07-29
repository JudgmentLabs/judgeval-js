import { describe, expect, spyOn, test } from "bun:test";
import type { Attributes, Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { JudgmentApiClient } from "../internal/api";
import { Tracer as WorkerTracer } from "../workers/Tracer";
import { WorkerTracerProvider } from "../workers/WorkerTracerProvider";
import { JudgmentTracerProvider } from "./JudgmentTracerProvider";
import { OfflineTracer } from "./OfflineTracer";
import { setTraceRuntime } from "./runtime";
import { Tracer } from "./Tracer";

class ResourceCaptureProcessor implements SpanProcessor {
  attributes: Attributes = {};

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  onStart(span: Span, _parentContext: Context): void {
    this.attributes = span.resource.attributes;
  }

  onEnd(_span: ReadableSpan): void {}

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

function expectStandardEnvironment(processor: ResourceCaptureProcessor): void {
  expect(processor.attributes["deployment.environment.name"]).toBe("staging");
  expect(processor.attributes["deployment.environment"]).toBeUndefined();
}

function mockProjectResolution() {
  return spyOn(
    JudgmentApiClient.prototype,
    "postV1projectsResolve",
  ).mockResolvedValue({
    project_id: "project-id",
  });
}

describe("deployment environment resource attribute", () => {
  test("uses deployment.environment.name in the Node tracer", async () => {
    const resolveSpy = mockProjectResolution();
    const processor = new ResourceCaptureProcessor();
    const tracer = await Tracer.init({
      projectName: "node-resource-test",
      apiKey: "key",
      organizationId: "org",
      apiUrl: "https://api.test",
      environment: "staging",
      setActive: false,
      spanProcessors: [processor],
    });

    try {
      tracer._tracerProvider
        .getTracer("resource-test")
        .startSpan("resource-test");
      expectStandardEnvironment(processor);
    } finally {
      JudgmentTracerProvider.getInstance().deregister(tracer);
      await tracer._tracerProvider.shutdown();
      resolveSpy.mockRestore();
    }
  });

  test("uses deployment.environment.name in the offline tracer", async () => {
    const resolveSpy = mockProjectResolution();
    const processor = new ResourceCaptureProcessor();
    const tracer = await OfflineTracer.create({
      projectName: "offline-resource-test",
      apiKey: "key",
      organizationId: "org",
      apiUrl: "https://api.test",
      environment: "staging",
      setActive: false,
      dataset: [],
      spanProcessors: [processor],
    });

    try {
      tracer._tracerProvider
        .getTracer("resource-test")
        .startSpan("resource-test");
      expectStandardEnvironment(processor);
    } finally {
      JudgmentTracerProvider.getInstance().deregister(tracer);
      await tracer._tracerProvider.shutdown();
      resolveSpy.mockRestore();
    }
  });

  test("uses deployment.environment.name in the Workers tracer", async () => {
    const processor = new ResourceCaptureProcessor();
    const tracer = await WorkerTracer.init({
      projectId: "project-id",
      apiKey: "key",
      organizationId: "org",
      apiUrl: "https://api.test",
      environment: "staging",
      setActive: false,
      spanProcessors: [processor],
    });

    try {
      tracer._tracerProvider
        .getTracer("resource-test")
        .startSpan("resource-test");
      expectStandardEnvironment(processor);
    } finally {
      WorkerTracerProvider.getInstance().deregister(tracer);
      await tracer._tracerProvider.shutdown();
      setTraceRuntime(JudgmentTracerProvider.getInstance());
    }
  });
});
