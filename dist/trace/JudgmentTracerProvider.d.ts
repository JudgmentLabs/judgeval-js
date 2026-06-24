import { type Context, type Span, type SpanContext, type Tracer, type TracerProvider } from "@opentelemetry/api";
import { type Instrumentation } from "@opentelemetry/instrumentation";
import type { BaseTracer } from "./BaseTracer";
/**
 * Global singleton that manages tracer registration and context propagation.
 *
 * Acts as a proxy TracerProvider that delegates to the currently active
 * tracer's underlying OpenTelemetry provider.
 */
export declare class JudgmentTracerProvider implements TracerProvider {
    private static _instance;
    private _activeTracer;
    private _instrumentations;
    private _noOpTracer;
    private _proxyTracer;
    private _tracers;
    private constructor();
    /**
     * Get the singleton JudgmentTracerProvider instance.
     *
     * @returns The global provider instance.
     */
    static getInstance(): JudgmentTracerProvider;
    /**
     * Install the JudgmentTracerProvider as the global tracer provider.
     * This generally does not need to be called - Judgeval automatically uses this for all its observability functionality.
     * Only use this if you specifically want to override the global tracer provider, which will enable all Opentelemetry captured instrumentations to flow through judgeval.
     * @returns True if the installation was successful, false otherwise.
     */
    static installAsGlobalTracerProvider(): boolean;
    /**
     * Register a tracer with the provider.
     *
     * @param tracer - The tracer to register.
     */
    register(tracer: BaseTracer): void;
    /**
     * Remove a tracer from the provider.
     *
     * @param tracer - The tracer to deregister.
     */
    deregister(tracer: BaseTracer): void;
    /**
     * Set a tracer as the active tracer.
     *
     * Cannot be called while a root span is active.
     *
     * @param tracer - The tracer to activate.
     * @returns `true` if activation succeeded.
     */
    setActive(tracer: BaseTracer): boolean;
    /**
     * Get the currently active tracer.
     *
     * @returns The active tracer, or `null` if none.
     */
    getActiveTracer(): BaseTracer | null;
    /**
     * Get the current OpenTelemetry context.
     *
     * @returns The current context.
     */
    getCurrentContext(): Context;
    /**
     * Set a span on a context, returning a new context.
     */
    setSpan(ctx: Context, span: Span): Context;
    /**
     * Wrap a SpanContext into a non-recording Span.
     */
    wrapSpanContext(spanContext: SpanContext): Span;
    /**
     * Get the span from the current context.
     *
     * @returns The current span, or `undefined` if none.
     */
    getCurrentSpan(): Span | undefined;
    /**
     * Check whether there is an active root span.
     *
     * @returns `true` if a root span is currently recording.
     */
    hasActiveRootSpan(): boolean;
    _getDelegateTracer(): Tracer;
    getTracer(_instrumentingModuleName: string, _instrumentingLibraryVersion?: string, _options?: {
        schemaUrl?: string;
    }): Tracer;
    /**
     * Register an OpenTelemetry instrumentation.
     *
     * @param instrumentor - The instrumentation to add.
     */
    addInstrumentation(instrumentor: Instrumentation): void;
    useSpan<T>(span: Span, endOnExit: boolean, recordException: boolean, setStatusOnException: boolean, fn: () => T): T;
    attachContext(ctx: Context): void;
    /**
     * Run `fn` with `ctx` installed as the active context for the
     * duration of the callback. Sync or async.
     */
    withContext<T>(ctx: Context, fn: () => T): T;
    /**
     * Flush all registered tracers.
     */
    forceFlush(): Promise<void>;
    /**
     * Shut down all registered tracers and clear state.
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=JudgmentTracerProvider.d.ts.map