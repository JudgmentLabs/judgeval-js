import {
  INVALID_SPAN_CONTEXT,
  trace,
  type Context,
  type Span,
  type SpanOptions,
  type Tracer,
} from "@opentelemetry/api";

export class NoOpTracer implements Tracer {
  startSpan(): Span {
    return trace.wrapSpanContext(INVALID_SPAN_CONTEXT);
  }

  startActiveSpan<F extends (span: Span) => unknown>(
    name: string,
    fn: F,
  ): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(
    name: string,
    options: SpanOptions,
    fn: F,
  ): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(
    name: string,
    options: SpanOptions,
    context: Context,
    fn: F,
  ): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(
    _name: string,
    ...args: [F] | [SpanOptions, F] | [SpanOptions, Context, F]
  ): ReturnType<F> {
    const fn =
      args.length === 1 ? args[0] : args.length === 2 ? args[1] : args[2];
    return fn(this.startSpan()) as ReturnType<F>;
  }
}

/**
 * Shared, stateless no-op tracer. Reused by the runtime fallback and by each
 * provider's "no active tracer" path, so there is a single instance rather
 * than one per provider.
 */
export const noOpTracer = new NoOpTracer();
