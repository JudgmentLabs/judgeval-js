import type { Context, SpanContext } from "@opentelemetry/api";
import { BatchSpanProcessor, type ReadableSpan, type Span, type SpanExporter } from "@opentelemetry/sdk-trace-base";
import type { BaseTracer } from "../BaseTracer";
/**
 * Span processor that manages span lifecycle, state, and batched export
 * to the Judgment platform. Supports per-span state (counters, lists),
 * partial-span emission for streaming updates, and baggage propagation
 * onto child spans.
 *
 * Created automatically by `Tracer.init()`. Use it directly only when
 * building a custom tracing pipeline.
 */
export declare class JudgmentSpanProcessor extends BatchSpanProcessor {
    tracer: BaseTracer | null;
    private _state;
    private _spanFinalizers;
    private _baggageProcessor;
    constructor(tracer: BaseTracer | null, exporter: SpanExporter, config?: {
        maxQueueSize?: number;
        scheduledDelayMillis?: number;
        maxExportBatchSize?: number;
        exportTimeoutMillis?: number;
    });
    private _cleanupSpanState;
    private _registerSpan;
    /** Store a value in the mutable state for a span. */
    stateSet(spanContext: SpanContext, key: string, value: unknown): void;
    /** Retrieve a value from the mutable state for a span. */
    stateGet<T>(spanContext: SpanContext, key: string, defaultValue: T): T;
    /** Atomically increment a counter. Returns the value before increment. */
    stateIncr(spanContext: SpanContext, key: string): number;
    /** Atomically append to a list. Returns the new list. */
    stateAppend<T>(spanContext: SpanContext, key: string, item: T): T[];
    private _emitSpan;
    /** Export the current span's in-progress state for streaming updates. */
    emitPartial(): void;
    onStart(span: Span, parentContext: Context): void;
    onEnd(span: ReadableSpan): void;
}
//# sourceMappingURL=JudgmentSpanProcessor.d.ts.map