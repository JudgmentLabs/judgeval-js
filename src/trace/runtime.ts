import {
  ROOT_CONTEXT,
  trace,
  type Context,
  type Span,
  type SpanContext,
  type Tracer,
} from "@opentelemetry/api";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import type { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import type { JudgmentApiClient } from "../internal/api";
import { Logger } from "../utils/logger";
import type { Serializer } from "../utils/serializer";
import type { JudgmentSpanExporter } from "./exporters/JudgmentSpanExporter";
import { NoOpTracer } from "./NoOpTracer";
import type { JudgmentSpanProcessor } from "./processors/JudgmentSpanProcessor";

export interface TraceRuntimeTracer {
  projectName: string | null;
  projectId: string | null;
  apiKey: string | null;
  organizationId: string | null;
  apiUrl: string | null;
  environment: string | null;
  serializer: Serializer;
  _tracerProvider: BasicTracerProvider;
  _client: JudgmentApiClient | null;
  _enableMonitoring: boolean;
  supportsLiveInstrumentation: boolean;
  getSpanExporter(): JudgmentSpanExporter;
  getSpanProcessor(): JudgmentSpanProcessor;
}

/**
 * Runtime indirection that decouples {@link BaseTracer} from the concrete
 * tracer provider.
 *
 * `BaseTracer` is shared by both the Node and Workers entrypoints, so it must
 * not import a specific provider: `JudgmentTracerProvider` pulls in Node-only
 * `async_hooks`, which would break the Workers bundle. Instead `BaseTracer`
 * talks to this `TraceRuntime` interface. Each provider installs itself via
 * {@link setTraceRuntime} from its constructor (`JudgmentTracerProvider` on
 * Node, `WorkerTracerProvider` on Workers). Until one does, {@link getTraceRuntime}
 * returns {@link noOpRuntime} — a fallback that still runs user code but does
 * not record, register instrumentation, or export spans.
 */
export interface TraceRuntime {
  register(tracer: TraceRuntimeTracer): void;
  deregister(tracer: TraceRuntimeTracer): void;
  setActive(tracer: TraceRuntimeTracer): boolean;
  getActiveTracer(): TraceRuntimeTracer | null;
  getCurrentContext(): Context;
  setSpan(ctx: Context, span: Span): Context;
  wrapSpanContext(spanContext: SpanContext): Span;
  getCurrentSpan(): Span | undefined;
  getTracer(
    instrumentingModuleName: string,
    instrumentingLibraryVersion?: string,
    options?: { schemaUrl?: string },
  ): Tracer;
  addInstrumentation(instrumentor: Instrumentation): void;
  useSpan<T>(
    span: Span,
    endOnExit: boolean,
    recordException: boolean,
    setStatusOnException: boolean,
    fn: () => T,
  ): T;
  attachContext(ctx: Context): void;
  withContext<T>(ctx: Context, fn: () => T): T;
  forceFlush(): Promise<void>;
  shutdown(): Promise<void>;
}

const noOpTracer = new NoOpTracer();

// Fallback runtime used before init; it preserves helper semantics without
// recording, registering instrumentation, or exporting spans.
const noOpRuntime: TraceRuntime = {
  register() {
    /* empty */
  },
  deregister() {
    /* empty */
  },
  setActive() {
    return false;
  },
  getActiveTracer() {
    return null;
  },
  getCurrentContext() {
    return ROOT_CONTEXT;
  },
  // setSpan/wrapSpanContext delegate to the stateless @opentelemetry/api
  // helpers, which need no provider or ambient state. This lets the fallback
  // still produce valid contexts and (non-recording) spans before init().
  setSpan(ctx, span) {
    return trace.setSpan(ctx, span);
  },
  wrapSpanContext(spanContext) {
    return trace.wrapSpanContext(spanContext);
  },
  getCurrentSpan() {
    return undefined;
  },
  getTracer() {
    Logger.debug("No active tracer provider, returning NoOpTracer");
    return noOpTracer;
  },
  addInstrumentation() {
    Logger.warning(
      "No active tracer provider. Instrumentation was not registered.",
    );
  },
  // No active provider yet: there is no recording span and no context to
  // isolate, so the endOnExit/record/setStatus flags are no-ops here. Just run
  // the callback — real span lifecycle handling lives in the concrete providers.
  useSpan(_span, _endOnExit, _recordException, _setStatusOnException, fn) {
    return fn();
  },
  attachContext() {
    /* empty */
  },
  withContext(_ctx, fn) {
    return fn();
  },
  forceFlush() {
    return Promise.resolve();
  },
  shutdown() {
    return Promise.resolve();
  },
};

let runtime: TraceRuntime | null = null;

export function setTraceRuntime(nextRuntime: TraceRuntime): void {
  runtime = nextRuntime;
}

export function getTraceRuntime(): TraceRuntime {
  return runtime ?? noOpRuntime;
}
