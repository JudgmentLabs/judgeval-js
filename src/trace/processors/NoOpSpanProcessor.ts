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

  stateSet(_spanContext: SpanContext, _key: string, _value: unknown): void {
    /* empty */
  }

  stateGet<T>(_spanContext: SpanContext, _key: string, defaultValue: T): T {
    return defaultValue;
  }

  stateIncr(_spanContext: SpanContext, _key: string): number {
    return 0;
  }

  stateAppend<T>(_spanContext: SpanContext, _key: string, item: T): T[] {
    return [item];
  }
}
