import { type Context, type Span, type SpanContext, type Tracer } from "@opentelemetry/api";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import type { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import type { JudgmentApiClient } from "../internal/api";
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
    getTracer(instrumentingModuleName: string, instrumentingLibraryVersion?: string, options?: {
        schemaUrl?: string;
    }): Tracer;
    addInstrumentation(instrumentor: Instrumentation): void;
    useSpan<T>(span: Span, endOnExit: boolean, recordException: boolean, setStatusOnException: boolean, fn: () => T): T;
    attachContext(ctx: Context): void;
    withContext<T>(ctx: Context, fn: () => T): T;
    forceFlush(): Promise<void>;
    shutdown(): Promise<void>;
}
export declare function setTraceRuntime(nextRuntime: TraceRuntime): void;
export declare function getTraceRuntime(): TraceRuntime;
export declare function setLLMWrapper(wrapper: (client: unknown) => unknown): void;
export declare function wrapLLMClient<T>(client: T): T;
//# sourceMappingURL=runtime.d.ts.map