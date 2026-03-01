import type { Context, HrTime, SpanContext } from "@opentelemetry/api";
import {
  BatchSpanProcessor,
  type ReadableSpan,
  type Span,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import {
  AttributeKeys,
  InternalAttributeKeys,
} from "../../JudgmentAttributeKeys";
import type { BaseTracer } from "../BaseTracer";
import { JudgmentTracerProvider } from "../JudgmentTracerProvider";
import { getAll } from "./_lifecycles";

type SpanKey = `${string}:${string}`;

function makeSpanKey(ctx: SpanContext): SpanKey {
  return `${ctx.traceId}:${ctx.spanId}`;
}

function isZeroHrTime(hrTime: HrTime): boolean {
  return hrTime[0] === 0 && hrTime[1] === 0;
}

export class JudgmentSpanProcessor extends BatchSpanProcessor {
  tracer: BaseTracer | null;
  private _internalAttributes = new Map<SpanKey, Map<string, unknown>>();

  constructor(
    tracer: BaseTracer | null,
    exporter: SpanExporter,
    config?: {
      maxQueueSize?: number;
      scheduledDelayMillis?: number;
      maxExportBatchSize?: number;
      exportTimeoutMillis?: number;
    },
  ) {
    super(exporter, config);
    this.tracer = tracer;
  }

  private _cleanupSpanState(spanKey: SpanKey): void {
    this._internalAttributes.delete(spanKey);
  }

  setInternalAttribute(
    spanContext: SpanContext,
    key: string,
    value: unknown,
  ): void {
    const spanKey = makeSpanKey(spanContext);
    let attrs = this._internalAttributes.get(spanKey);
    if (!attrs) {
      attrs = new Map();
      this._internalAttributes.set(spanKey, attrs);
    }
    attrs.set(key, value);
  }

  getInternalAttribute(
    spanContext: SpanContext,
    key: string,
    defaultValue: unknown = null,
  ): unknown {
    const spanKey = makeSpanKey(spanContext);
    const attrs = this._internalAttributes.get(spanKey);
    if (!attrs) return defaultValue;
    return attrs.has(key) ? attrs.get(key) : defaultValue;
  }

  private _emitSpan(span: ReadableSpan): void {
    const ctx = span.spanContext();
    const spanKey = makeSpanKey(ctx);
    let attrs = this._internalAttributes.get(spanKey);
    if (!attrs) {
      attrs = new Map();
      this._internalAttributes.set(spanKey, attrs);
    }

    const currId =
      (attrs.get(AttributeKeys.JUDGMENT_UPDATE_ID) as number | undefined) ?? 0;
    attrs.set(AttributeKeys.JUDGMENT_UPDATE_ID, currId + 1);

    const newAttributes = {
      ...span.attributes,
      [AttributeKeys.JUDGMENT_UPDATE_ID]: currId,
    };

    const emittedSpan = Object.create(span) as ReadableSpan;
    Object.defineProperty(emittedSpan, "attributes", {
      value: newAttributes,
      writable: false,
    });
    const endTime =
      isZeroHrTime(span.endTime)
        ? span.startTime
        : span.endTime;
    Object.defineProperty(emittedSpan, "endTime", {
      value: endTime,
      writable: false,
    });

    super.onEnd(emittedSpan);
  }

  emitPartial(): void {
    const proxy = JudgmentTracerProvider.getInstance();
    const span = proxy.getCurrentSpan();
    if (!span?.isRecording()) return;
    if (
      this.getInternalAttribute(
        span.spanContext(),
        InternalAttributeKeys.DISABLE_PARTIAL_EMIT,
        false,
      )
    )
      return;
    // TODO: review, is this fine?
    this._emitSpan(span as unknown as ReadableSpan);
  }

  onStart(span: Span, parentContext: Context): void {
    for (const processor of getAll()) {
      processor.onStart(span, parentContext);
    }
  }

  onEnd(span: ReadableSpan): void {
    for (const processor of getAll()) {
      processor.onEnd(span);
    }
    const ctx = span.spanContext();
    const isCancelled = this.getInternalAttribute(
      ctx,
      InternalAttributeKeys.CANCELLED,
      false,
    );
    if (!isCancelled) {
      this._emitSpan(span);
    }
    const spanKey = makeSpanKey(ctx);
    this._cleanupSpanState(spanKey);
  }
}
