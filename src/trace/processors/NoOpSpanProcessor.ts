import type { Context, SpanContext } from "@opentelemetry/api";
import type { ReadableSpan, Span } from "@opentelemetry/sdk-trace-base";
import { NoOpSpanExporter } from "../exporters/NoOpSpanExporter";
import { JudgmentSpanProcessor } from "./JudgmentSpanProcessor";

/**
 * A no-op span processor that discards all spans.
 *
 * Used when monitoring is disabled or credentials are missing.
 */
export class NoOpSpanProcessor extends JudgmentSpanProcessor {
  constructor() {
    super(null, new NoOpSpanExporter());
  }

  onStart(_span: Span, _parentContext: Context): void {
    /* empty */
  }

  onEnd(_span: ReadableSpan): void {
    /* empty */
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  emitPartial(): void {
    /* empty */
  }

  setInternalAttribute(
    _spanContext: SpanContext,
    _key: string,
    _value: unknown,
  ): void {
    /* empty */
  }

  getInternalAttribute(
    _spanContext: SpanContext,
    _key: string,
    defaultValue: unknown = null,
  ): unknown {
    return defaultValue;
  }
}
