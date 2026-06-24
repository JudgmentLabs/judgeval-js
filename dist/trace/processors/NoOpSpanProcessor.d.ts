import type { Context, SpanContext } from "@opentelemetry/api";
import type { ReadableSpan, Span } from "@opentelemetry/sdk-trace-base";
import { JudgmentSpanProcessor } from "./JudgmentSpanProcessor";
/**
 * A no-op span processor that discards all spans.
 *
 * Used when monitoring is disabled or credentials are missing.
 */
export declare class NoOpSpanProcessor extends JudgmentSpanProcessor {
    constructor();
    onStart(_span: Span, _parentContext: Context): void;
    onEnd(_span: ReadableSpan): void;
    shutdown(): Promise<void>;
    forceFlush(): Promise<void>;
    emitPartial(): void;
    stateSet(_spanContext: SpanContext, _key: string, _value: unknown): void;
    stateGet<T>(_spanContext: SpanContext, _key: string, defaultValue: T): T;
    stateIncr(_spanContext: SpanContext, _key: string): number;
    stateAppend<T>(_spanContext: SpanContext, _key: string, item: T): T[];
}
//# sourceMappingURL=NoOpSpanProcessor.d.ts.map