import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { getBaggage } from "../baggage";

/**
 * Predicate that decides which baggage keys are propagated to span
 * attributes.
 */
export type BaggageKeyPredicate = (baggageKey: string) => boolean;

/** Default predicate that allows every baggage key. */
export const ALLOW_ALL_BAGGAGE_KEYS: BaggageKeyPredicate = () => true;

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
export class JudgmentBaggageSpanProcessor implements SpanProcessor {
  private _keyPredicate: BaggageKeyPredicate;

  constructor(keyPredicate: BaggageKeyPredicate = ALLOW_ALL_BAGGAGE_KEYS) {
    this._keyPredicate = keyPredicate;
  }

  /** Copy matching baggage entries from the parent context onto the span. */
  onStart(span: Span, parentContext: Context): void {
    const entries = getBaggage(parentContext)?.getAllEntries() ?? [];
    for (const [key, entry] of entries) {
      if (this._keyPredicate(key)) {
        span.setAttribute(key, entry.value);
      }
    }
  }

  /** No-op. */
  onEnd(_span: ReadableSpan): void {
    /* no-op */
  }

  /** No-op. */
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  /** No-op. */
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
