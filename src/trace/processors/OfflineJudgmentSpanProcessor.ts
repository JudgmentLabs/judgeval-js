import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import { Example } from "../../data/Example";
import type { BaseTracer } from "../BaseTracer";
import { JudgmentSpanProcessor } from "./JudgmentSpanProcessor";

/**
 * Span processor used by `OfflineTracer`.
 *
 * Extends `JudgmentSpanProcessor` (so it inherits batched export, span
 * state, and partial-emit support) and additionally appends a new
 * `Example` to the caller-supplied `dataset` list whenever a *root*
 * span ends. Each emitted example carries the `offline_trace_id` of
 * the trace plus any static `exampleFields` configured at init time.
 */
export class OfflineJudgmentSpanProcessor extends JudgmentSpanProcessor {
  private readonly _dataset: Example[];
  private readonly _exampleFields: Record<string, unknown>;
  private readonly _seenTraceIds = new Set<string>();

  constructor(
    tracer: BaseTracer,
    exporter: SpanExporter,
    options: {
      dataset: Example[];
      exampleFields?: Record<string, unknown>;
    },
  ) {
    super(tracer, exporter);
    this._dataset = options.dataset;
    this._exampleFields = { ...(options.exampleFields ?? {}) };
  }

  private _maybeCreateExample(span: ReadableSpan): void {
    if (span.parentSpanContext) return;
    const ctx = span.spanContext();
    if (!ctx?.traceId) return;

    if (this._seenTraceIds.has(ctx.traceId)) return;
    this._seenTraceIds.add(ctx.traceId);

    const example = Example.create({
      ...this._exampleFields,
      offline_trace_id: ctx.traceId,
    });
    this._dataset.push(example);
  }

  onEnd(span: ReadableSpan): void {
    try {
      this._maybeCreateExample(span);
    } finally {
      super.onEnd(span);
    }
  }
}
