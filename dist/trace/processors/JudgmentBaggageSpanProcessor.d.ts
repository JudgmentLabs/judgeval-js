import type { Context } from "@opentelemetry/api";
import type { ReadableSpan, Span, SpanProcessor } from "@opentelemetry/sdk-trace-base";
/**
 * Predicate that decides which baggage keys are propagated to span
 * attributes.
 */
export type BaggageKeyPredicate = (baggageKey: string) => boolean;
/** Default predicate that allows every baggage key. */
export declare const ALLOW_ALL_BAGGAGE_KEYS: BaggageKeyPredicate;
/**
 * Span processor that copies baggage entries onto span attributes at
 * span start. Use `keyPredicate` to control which keys are propagated.
 *
 * @example
 * ```typescript
 * const processor = new JudgmentBaggageSpanProcessor(
 *   (key) => key.startsWith("judgment."),
 * );
 * ```
 */
export declare class JudgmentBaggageSpanProcessor implements SpanProcessor {
    private _keyPredicate;
    constructor(keyPredicate?: BaggageKeyPredicate);
    /** Copy matching baggage entries from the parent context onto the span. */
    onStart(span: Span, parentContext: Context): void;
    /** No-op. */
    onEnd(_span: ReadableSpan): void;
    /** No-op. */
    forceFlush(): Promise<void>;
    /** No-op. */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=JudgmentBaggageSpanProcessor.d.ts.map