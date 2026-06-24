import {
  INVALID_SPAN_CONTEXT,
  ROOT_CONTEXT,
  SpanStatusCode,
  trace,
  type Context,
  type Span,
  type SpanContext,
  type SpanOptions,
  type Tracer,
} from "@opentelemetry/api";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import type { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import type { JudgmentApiClient } from "../internal/api";
import { Logger } from "../utils/logger";
import type { Serializer } from "../utils/serializer";
import type { JudgmentSpanExporter } from "./exporters/JudgmentSpanExporter";
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

class NoOpTracer implements Tracer {
  startSpan(): Span {
    return trace.wrapSpanContext(INVALID_SPAN_CONTEXT);
  }

  startActiveSpan<F extends (span: Span) => unknown>(
    name: string,
    fn: F,
  ): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(
    name: string,
    options: SpanOptions,
    fn: F,
  ): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(
    name: string,
    options: SpanOptions,
    context: Context,
    fn: F,
  ): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(
    _name: string,
    ...args: [F] | [SpanOptions, F] | [SpanOptions, Context, F]
  ): ReturnType<F> {
    const fn =
      args.length === 1 ? args[0] : args.length === 2 ? args[1] : args[2];
    return fn(this.startSpan()) as ReturnType<F>;
  }
}

const noOpTracer = new NoOpTracer();

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
  useSpan(span, endOnExit, recordException, setStatusOnException, fn) {
    try {
      const result = fn();
      if (result instanceof Promise) {
        return result
          .catch((exc: unknown) => {
            if (span.isRecording()) {
              if (recordException) span.recordException(exc as Error);
              if (setStatusOnException) {
                const err = exc as Error;
                span.setStatus({
                  code: SpanStatusCode.ERROR,
                  message: `${err.name}: ${err.message}`,
                });
              }
            }
            throw exc;
          })
          .finally(() => {
            if (endOnExit) span.end();
          }) as typeof result;
      }
      if (endOnExit) span.end();
      return result;
    } catch (exc) {
      if (span.isRecording()) {
        if (recordException) span.recordException(exc as Error);
        if (setStatusOnException) {
          const err = exc as Error;
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `${err.name}: ${err.message}`,
          });
        }
      }
      if (endOnExit) span.end();
      throw exc;
    }
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
let llmWrapper: ((client: unknown) => unknown) | null = null;

export function setTraceRuntime(nextRuntime: TraceRuntime): void {
  runtime = nextRuntime;
}

export function getTraceRuntime(): TraceRuntime {
  return runtime ?? noOpRuntime;
}

export function setLLMWrapper(wrapper: (client: unknown) => unknown): void {
  llmWrapper = wrapper;
}

export function wrapLLMClient<T>(client: T): T {
  if (!llmWrapper) {
    Logger.warning(
      "LLM client instrumentation is not available from this entrypoint.",
    );
    return client;
  }
  return llmWrapper(client) as T;
}
