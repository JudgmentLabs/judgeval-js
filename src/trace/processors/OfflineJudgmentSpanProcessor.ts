import { createContextKey, type Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { Example } from "../../data/Example";
import type { BaseTracer } from "../BaseTracer";
import { JudgmentSpanProcessor } from "./JudgmentSpanProcessor";

/**
 * Context key naming the dataset example a root span belongs to. Set it on
 * the context before starting the span and the processor records the
 * `exampleId -> traceId` pairing in {@link OfflineJudgmentSpanProcessor.exampleTraceIds}.
 */
export const OFFLINE_EXAMPLE_ID_KEY = createContextKey(
  "judgment.offline_example_id",
);

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
  /** `exampleId -> traceId` of the first root span started under that example's context. */
  readonly exampleTraceIds = new Map<string, string>();

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

  onStart(span: Span, parentContext: Context): void {
    const exampleId = parentContext.getValue(OFFLINE_EXAMPLE_ID_KEY);
    if (
      typeof exampleId === "string" &&
      exampleId &&
      !span.parentSpanContext &&
      !this.exampleTraceIds.has(exampleId)
    ) {
      this.exampleTraceIds.set(exampleId, span.spanContext().traceId);
    }
    super.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    try {
      this._maybeCreateExample(span);
    } finally {
      super.onEnd(span);
    }
  }
}
