import { type Context, propagation } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";

/**
 * Predicate that decides which baggage keys are propagated to span
 * attributes.
 */
export type BaggageKeyPredicate = (baggageKey: string) => boolean;

/** Default predicate that allows every baggage key. */
export const ALLOW_ALL_BAGGAGE_KEYS: BaggageKeyPredicate = () => true;

/**
 * Span processor that copies OTel baggage entries onto span attributes at
 * span start.
 *
 * When a span starts, this processor reads all baggage from the parent
 * context and sets matching entries as span attributes. Use
 * `keyPredicate` to control which keys are propagated.
 *
 * Matches the behavior of Python's `JudgmentBaggageProcessor` and the
 * community `@opentelemetry/baggage-span-processor`.
 *
 * @example
 * ```typescript
 * // Allow only Judgment-prefixed baggage keys
 * const processor = new JudgmentBaggageSpanProcessor(
 *   (key) => key.startsWith("judgment."),
 * );
 * ```
 */
export class JudgmentBaggageSpanProcessor implements SpanProcessor {
  private _keyPredicate: BaggageKeyPredicate;

  constructor(keyPredicate: BaggageKeyPredicate = ALLOW_ALL_BAGGAGE_KEYS) {
    this._keyPredicate = keyPredicate;
  }

  onStart(span: Span, parentContext: Context): void {
    const entries =
      propagation.getBaggage(parentContext)?.getAllEntries() ?? [];
    for (const [key, entry] of entries) {
      if (this._keyPredicate(key)) {
        span.setAttribute(key, entry.value);
      }
    }
  }

  onEnd(_span: ReadableSpan): void {
    /* no-op */
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
