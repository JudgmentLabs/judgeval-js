import {
  ROOT_CONTEXT,
  SpanStatusCode,
  trace,
  type Context,
  type Span,
  type SpanContext,
  type SpanOptions,
  type Tracer,
  type TracerProvider,
} from "@opentelemetry/api";
import { AsyncLocalStorage } from "async_hooks";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import { Logger } from "../utils/logger";
import { NoOpTracer } from "../trace/NoOpTracer";
import { setTraceRuntime, type TraceRuntimeTracer } from "../trace/runtime";
import type { ExportErrorSource } from "./WorkerSpanExporter";

const TRACER_NAME = "judgeval";

interface ContextHolder {
  ctx: Context;
}

const _contextStorage = new AsyncLocalStorage<ContextHolder>();

function takeExporterError(tracer: TraceRuntimeTracer): Error | undefined {
  const exporter = tracer.getSpanExporter() as Partial<ExportErrorSource>;
  return exporter.takeExportError?.();
}

class ProxyTracer implements Tracer {
  private _provider: WorkerTracerProvider;

  constructor(provider: WorkerTracerProvider) {
    this._provider = provider;
  }

  startSpan(name: string, options?: SpanOptions, context?: Context): Span {
    const ctx = context ?? this._provider.getCurrentContext();
    const delegate = this._provider._getDelegateTracer();
    return delegate.startSpan(name, options, ctx);
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
    name: string,
    ...args: [F] | [SpanOptions, F] | [SpanOptions, Context, F]
  ): ReturnType<F> {
    let options: SpanOptions = {};
    let context: Context = this._provider.getCurrentContext();
    let fn: F;

    if (args.length === 1) {
      fn = args[0];
    } else if (args.length === 2) {
      options = args[0];
      fn = args[1];
    } else {
      options = args[0];
      context = args[1];
      fn = args[2];
    }

    const span = this.startSpan(name, options, context);
    return this._provider.useSpan(span, false, false, false, () =>
      fn(span),
    ) as ReturnType<F>;
  }
}

export class WorkerTracerProvider implements TracerProvider {
  private static _instance: WorkerTracerProvider | null = null;

  private _activeTracer: TraceRuntimeTracer | null = null;
  private _noOpTracer: NoOpTracer;
  private _proxyTracer: ProxyTracer;
  private _tracers = new Set<TraceRuntimeTracer>();

  private constructor() {
    this._noOpTracer = new NoOpTracer();
    this._proxyTracer = new ProxyTracer(this);
    setTraceRuntime(this);
  }

  static getInstance(): WorkerTracerProvider {
    WorkerTracerProvider._instance ??= new WorkerTracerProvider();
    return WorkerTracerProvider._instance;
  }

  register(tracer: TraceRuntimeTracer): void {
    this._tracers.add(tracer);
  }

  deregister(tracer: TraceRuntimeTracer): void {
    this._tracers.delete(tracer);
  }

  setActive(tracer: TraceRuntimeTracer): boolean {
    const currentSpan = this.getCurrentSpan();
    if (currentSpan?.isRecording()) {
      if (trace.getSpan(this.getCurrentContext()) === currentSpan) {
        Logger.error(
          "Cannot set_active() while a root span is active. Keeping existing tracer provider.",
        );
        return false;
      }
    }
    this.register(tracer);
    this._activeTracer = tracer;
    return true;
  }

  getActiveTracer(): TraceRuntimeTracer | null {
    return this._activeTracer;
  }

  getCurrentContext(): Context {
    return _contextStorage.getStore()?.ctx ?? ROOT_CONTEXT;
  }

  setSpan(ctx: Context, span: Span): Context {
    return trace.setSpan(ctx, span);
  }

  wrapSpanContext(spanContext: SpanContext): Span {
    return trace.wrapSpanContext(spanContext);
  }

  getCurrentSpan(): Span | undefined {
    return trace.getSpan(this.getCurrentContext());
  }

  _getDelegateTracer(): Tracer {
    const tracer = this._activeTracer;
    if (!tracer) {
      Logger.debug("No active tracer, returning NoOpTracer");
      return this._noOpTracer;
    }
    return tracer._tracerProvider.getTracer(TRACER_NAME);
  }

  getTracer(
    _instrumentingModuleName: string,
    _instrumentingLibraryVersion?: string,
    _options?: { schemaUrl?: string },
  ): Tracer {
    return this._proxyTracer;
  }

  addInstrumentation(_instrumentor: Instrumentation): void {
    Logger.warning(
      "OpenTelemetry instrumentations are only supported by the Node entrypoint.",
    );
  }

  useSpan<T>(
    span: Span,
    endOnExit: boolean,
    recordException: boolean,
    setStatusOnException: boolean,
    fn: () => T,
  ): T {
    const prevCtx = this.getCurrentContext();
    const ctx = trace.setSpan(prevCtx, span);
    return _contextStorage.run({ ctx }, () => {
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
            }) as T;
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
    });
  }

  attachContext(ctx: Context): void {
    const holder = _contextStorage.getStore();
    if (holder) {
      holder.ctx = ctx;
    }
  }

  withContext<T>(ctx: Context, fn: () => T): T {
    return _contextStorage.run({ ctx }, fn);
  }

  async forceFlush(): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this._tracers).map((t) => t._tracerProvider.forceFlush()),
    );
    const errors: unknown[] = [];
    for (const r of results) {
      if (r.status === "rejected") {
        Logger.error(`forceFlush failed: ${String(r.reason)}`);
        errors.push(r.reason);
      }
    }
    if (errors.length === 0) {
      for (const tracer of this._tracers) {
        const error = takeExporterError(tracer);
        if (error) {
          Logger.error(`forceFlush export failed: ${String(error)}`);
          errors.push(error);
        }
      }
    }
    if (errors.length > 0) {
      throw errors[0];
    }
  }

  async shutdown(): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this._tracers).map((t) => t._tracerProvider.shutdown()),
    );
    for (const r of results) {
      if (r.status === "rejected") {
        Logger.error(`shutdown failed: ${String(r.reason)}`);
      }
    }
    this._activeTracer = null;
    this._tracers.clear();
  }
}
