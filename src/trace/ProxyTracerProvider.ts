import {
  INVALID_SPAN_CONTEXT,
  context as otelContext,
  SpanStatusCode,
  trace,
  type Context,
  type Span,
  type SpanOptions,
  type Tracer,
  type TracerProvider,
} from "@opentelemetry/api";
import {
  registerInstrumentations,
  type Instrumentation,
} from "@opentelemetry/instrumentation";
import { AsyncLocalStorage } from "async_hooks";
import { Logger } from "../utils/logger";
import type { BaseTracer } from "./BaseTracer";
import {
  installOtelContextBridge,
  runWithOtelBridgeGate,
} from "./instrumentation/OtelContextBridge";

const TRACER_NAME = "judgeval";

const _contextStorage = new AsyncLocalStorage<Context>();

class ProxyTracer implements Tracer {
  private _provider: ProxyTracerProvider;

  constructor(provider: ProxyTracerProvider) {
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
    return this._provider.useSpan(span, true, true, true, () =>
      fn(span),
    ) as ReturnType<F>;
  }
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

export class ProxyTracerProvider implements TracerProvider {
  private static _instance: ProxyTracerProvider | null = null;

  private _activeTracer: BaseTracer | null = null;
  private _instrumentations: Instrumentation[] = [];
  private _noOpTracer: NoOpTracer;
  private _proxyTracer: ProxyTracer;
  private _tracers = new Set<BaseTracer>();

  private constructor() {
    this._noOpTracer = new NoOpTracer();
    this._proxyTracer = new ProxyTracer(this);
    installOtelContextBridge(() => this.getCurrentContext());
  }

  static getInstance(): ProxyTracerProvider {
    ProxyTracerProvider._instance ??= new ProxyTracerProvider();
    return ProxyTracerProvider._instance;
  }

  register(tracer: BaseTracer): void {
    this._tracers.add(tracer);
  }

  deregister(tracer: BaseTracer): void {
    this._tracers.delete(tracer);
  }

  setActive(tracer: BaseTracer): boolean {
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

  getActiveTracer(): BaseTracer | null {
    return this._activeTracer;
  }

  getCurrentContext(): Context {
    return _contextStorage.getStore() ?? otelContext.active();
  }

  getCurrentSpan(): Span | undefined {
    const ctx = this.getCurrentContext();
    return trace.getSpan(ctx);
  }

  hasActiveRootSpan(): boolean {
    const currentSpan = this.getCurrentSpan();
    if (!currentSpan?.isRecording()) return false;
    return true;
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

  addInstrumentation(
    instrumentations: Instrumentation | Instrumentation[],
  ): void {
    const list = Array.isArray(instrumentations)
      ? instrumentations
      : [instrumentations];
    try {
      registerInstrumentations({
        tracerProvider: this,
        instrumentations: list,
      });
      this._instrumentations.push(...list);
    } catch (err: unknown) {
      Logger.error(`Failed to add instrumentation: ${String(err)}`);
    }
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
    return _contextStorage.run(ctx, () =>
      runWithOtelBridgeGate(ctx, () => {
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
      }),
    );
  }

  attachContext(ctx: Context): void {
    _contextStorage.enterWith(ctx);
  }

  async forceFlush(): Promise<void> {
    await Promise.all(
      Array.from(this._tracers).map((t) => t._tracerProvider.forceFlush()),
    );
  }

  async shutdown(): Promise<void> {
    await Promise.all(
      Array.from(this._tracers).map((t) => t._tracerProvider.shutdown()),
    );
    this._activeTracer = null;
    this._tracers.clear();
  }
}
