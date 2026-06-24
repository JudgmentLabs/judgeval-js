import { type Context, type Span, type SpanContext, type Tracer, type TracerProvider } from "@opentelemetry/api";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import { type TraceRuntimeTracer } from "../trace/runtime";
export declare class WorkerTracerProvider implements TracerProvider {
    private static _instance;
    private _activeTracer;
    private _noOpTracer;
    private _proxyTracer;
    private _tracers;
    private constructor();
    static getInstance(): WorkerTracerProvider;
    register(tracer: TraceRuntimeTracer): void;
    deregister(tracer: TraceRuntimeTracer): void;
    setActive(tracer: TraceRuntimeTracer): boolean;
    getActiveTracer(): TraceRuntimeTracer | null;
    getCurrentContext(): Context;
    setSpan(ctx: Context, span: Span): Context;
    wrapSpanContext(spanContext: SpanContext): Span;
    getCurrentSpan(): Span | undefined;
    hasActiveRootSpan(): boolean;
    _getDelegateTracer(): Tracer;
    getTracer(_instrumentingModuleName: string, _instrumentingLibraryVersion?: string, _options?: {
        schemaUrl?: string;
    }): Tracer;
    addInstrumentation(_instrumentor: Instrumentation): void;
    useSpan<T>(span: Span, endOnExit: boolean, recordException: boolean, setStatusOnException: boolean, fn: () => T): T;
    attachContext(ctx: Context): void;
    withContext<T>(ctx: Context, fn: () => T): T;
    forceFlush(): Promise<void>;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=WorkerTracerProvider.d.ts.map