import {
  INVALID_SPAN_CONTEXT,
  ROOT_CONTEXT,
  SpanStatusCode,
  context as otelContextApi,
  trace,
  type Context,
  type Span,
  type SpanContext,
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
import { JudgmentContextManager } from "./instrumentation/JudgmentContextManager";

const TRACER_NAME = "judgeval";

const _contextStorage = new AsyncLocalStorage<Context>();

class ProxyTracer implements Tracer {
  private _provider: JudgmentTracerProvider;

  constructor(provider: JudgmentTracerProvider) {
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

/**
 * Global singleton that manages tracer registration and context propagation.
 *
 * Acts as a proxy TracerProvider that delegates to the currently active
 * tracer's underlying OpenTelemetry provider.
 */
export class JudgmentTracerProvider implements TracerProvider {
  private static _instance: JudgmentTracerProvider | null = null;

  private _activeTracer: BaseTracer | null = null;
  private _instrumentations: Instrumentation[] = [];
  private _noOpTracer: NoOpTracer;
  private _proxyTracer: ProxyTracer;
  private _tracers = new Set<BaseTracer>();

  private constructor() {
    this._noOpTracer = new NoOpTracer();
    this._proxyTracer = new ProxyTracer(this);
    otelContextApi.setGlobalContextManager(
      new JudgmentContextManager(_contextStorage),
    );
  }

  /**
   * Get the singleton JudgmentTracerProvider instance.
   *
   * @returns The global provider instance.
   */
  static getInstance(): JudgmentTracerProvider {
    JudgmentTracerProvider._instance ??= new JudgmentTracerProvider();
    return JudgmentTracerProvider._instance;
  }

  /**
   * Install the JudgmentTracerProvider as the global tracer provider.
   * This generally does not need to be called - Judgeval automatically uses this for all its observability functionality.
   * Only use this if you specifically want to override the global tracer provider, which will enable all Opentelemetry captured instrumentations to flow through judgeval.
   * @returns True if the installation was successful, false otherwise.
   */
  static installAsGlobalTracerProvider(): boolean {
    const instance = JudgmentTracerProvider.getInstance();
    return trace.setGlobalTracerProvider(instance);
  }

  /**
   * Register a tracer with the provider.
   *
   * @param tracer - The tracer to register.
   */
  register(tracer: BaseTracer): void {
    this._tracers.add(tracer);
  }

  /**
   * Remove a tracer from the provider.
   *
   * @param tracer - The tracer to deregister.
   */
  deregister(tracer: BaseTracer): void {
    this._tracers.delete(tracer);
  }

  /**
   * Set a tracer as the active tracer.
   *
   * Cannot be called while a root span is active.
   *
   * @param tracer - The tracer to activate.
   * @returns `true` if activation succeeded.
   */
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

  /**
   * Get the currently active tracer.
   *
   * @returns The active tracer, or `null` if none.
   */
  getActiveTracer(): BaseTracer | null {
    return this._activeTracer;
  }

  /**
   * Get the current OpenTelemetry context.
   *
   * @returns The current context.
   */
  getCurrentContext(): Context {
    return _contextStorage.getStore() ?? ROOT_CONTEXT;
  }

  /**
   * Set a span on a context, returning a new context.
   */
  setSpan(ctx: Context, span: Span): Context {
    return trace.setSpan(ctx, span);
  }

  /**
   * Wrap a SpanContext into a non-recording Span.
   */
  wrapSpanContext(spanContext: SpanContext): Span {
    return trace.wrapSpanContext(spanContext);
  }

  /**
   * Get the span from the current context.
   *
   * @returns The current span, or `undefined` if none.
   */
  getCurrentSpan(): Span | undefined {
    const ctx = this.getCurrentContext();
    return trace.getSpan(ctx);
  }

  /**
   * Check whether there is an active root span.
   *
   * @returns `true` if a root span is currently recording.
   */
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

  /**
   * Register an OpenTelemetry instrumentation.
   *
   * @param instrumentor - The instrumentation to add.
   */
  addInstrumentation(instrumentor: Instrumentation): void {
    try {
      registerInstrumentations({
        tracerProvider: this,
        instrumentations: [instrumentor],
      });
      this._instrumentations.push(instrumentor);
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
    return _contextStorage.run(ctx, () => {
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
    _contextStorage.enterWith(ctx);
  }

  /**
   * Run `fn` with `ctx` installed as the active context for the
   * duration of the callback. Sync or async.
   */
  withContext<T>(ctx: Context, fn: () => T): T {
    return _contextStorage.run(ctx, fn);
  }

  /**
   * Flush all registered tracers.
   */
  async forceFlush(): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this._tracers).map((t) => t._tracerProvider.forceFlush()),
    );
    for (const r of results) {
      if (r.status === "rejected") {
        Logger.error(`forceFlush failed: ${String(r.reason)}`);
      }
    }
  }

  /**
   * Shut down all registered tracers and clear state.
   */
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
