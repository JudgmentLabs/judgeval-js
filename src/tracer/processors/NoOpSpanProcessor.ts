import { type Context } from "@opentelemetry/api";
import type { ReadableSpan, Span } from "@opentelemetry/sdk-trace-base";
import { type BaseTracer } from "../BaseTracer";
import { NoOpSpanExporter } from "../exporters/NoOpSpanExporter";
import { JudgmentSpanProcessor } from "./JudgmentSpanProcessor";

export class NoOpSpanProcessor extends JudgmentSpanProcessor {
  constructor(tracer: BaseTracer) {
    super(tracer, new NoOpSpanExporter());
  }

  onStart(_span: Span, _parentContext: Context): void {
    return;
  }

  onEnd(_span: ReadableSpan): void {
    return;
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  protected onShutdown(): void {
    return;
  }
}
