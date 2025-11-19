import {
  type Context,
  type Span,
  type SpanOptions,
  type Tracer,
} from "@opentelemetry/api";
import { NoOpSpan } from "./NoOpSpan";

export class NoOpTracer implements Tracer {
  private readonly noopSpan = new NoOpSpan();

  startSpan(_name: string, _options?: SpanOptions, _context?: Context): Span {
    return this.noopSpan;
  }

  startActiveSpan<F extends (span: Span) => unknown>(
    _name: string,
    fn: F,
  ): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(
    _name: string,
    _options: SpanOptions,
    fn: F,
  ): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(
    _name: string,
    _options: SpanOptions,
    _context: Context,
    fn: F,
  ): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(
    _name: string,
    ...args: unknown[]
  ): ReturnType<F> {
    const fn = args[args.length - 1] as F;
    return fn(this.noopSpan) as ReturnType<F>;
  }
}
