import type {
  Attributes,
  Context,
  HrTime,
  Span as ApiSpan,
  SpanContext,
} from "@opentelemetry/api";
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
import { dontThrow } from "../../utils/dont-throw";
import type { BaseTracer } from "../BaseTracer";
import { getTraceRuntime } from "../runtime";
import { JudgmentBaggageSpanProcessor } from "./JudgmentBaggageSpanProcessor";

type SpanKey = `${string}:${string}`;

function makeSpanKey(ctx: SpanContext): SpanKey {
  return `${ctx.traceId}:${ctx.spanId}`;
}

function isZeroHrTime(hrTime: HrTime): boolean {
  return hrTime[0] === 0 && hrTime[1] === 0;
}

/**
 * Span processor that manages span lifecycle, state, and batched export
 * to the Judgment platform. Supports per-span state (counters, lists),
 * partial-span emission for streaming updates, and baggage propagation
 * onto child spans.
 *
 * Created automatically by `Tracer.init()`. Use it directly only when
 * building a custom tracing pipeline.
 */
export class JudgmentSpanProcessor extends BatchSpanProcessor {
  tracer: BaseTracer | null;
  private _state = new Map<SpanKey, Map<string, unknown>>();
  private _spanFinalizers: FinalizationRegistry<SpanKey>;
  private _baggageProcessor: JudgmentBaggageSpanProcessor;

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
    this._spanFinalizers = new FinalizationRegistry<SpanKey>((spanKey) => {
      this._cleanupSpanState(spanKey);
    });
    this._baggageProcessor = new JudgmentBaggageSpanProcessor();
  }

  private _cleanupSpanState(spanKey: SpanKey): void {
    this._state.delete(spanKey);
  }

  private _registerSpan(span: Span): void {
    const ctx = span.spanContext();
    if (!ctx.traceId || !ctx.spanId) return;
    const spanKey = makeSpanKey(ctx);
    // Registers the live Span object with the GC; if it is ever
    // collected without going through `onEnd`, cleanup still runs.
    this._spanFinalizers.register(span, spanKey);
  }

  /** Store a value in the mutable state for a span. */
  stateSet(spanContext: SpanContext, key: string, value: unknown): void {
    const spanKey = makeSpanKey(spanContext);
    let attrs = this._state.get(spanKey);
    if (!attrs) {
      attrs = new Map();
      this._state.set(spanKey, attrs);
    }
    attrs.set(key, value);
  }

  /** Retrieve a value from the mutable state for a span. */
  stateGet<T>(spanContext: SpanContext, key: string, defaultValue: T): T {
    const spanKey = makeSpanKey(spanContext);
    const attrs = this._state.get(spanKey);
    if (!attrs?.has(key)) return defaultValue;
    return attrs.get(key) as T;
  }

  /** Atomically increment a counter. Returns the value before increment. */
  stateIncr(spanContext: SpanContext, key: string): number {
    const spanKey = makeSpanKey(spanContext);
    let attrs = this._state.get(spanKey);
    if (!attrs) {
      attrs = new Map();
      this._state.set(spanKey, attrs);
    }
    const stored = attrs.get(key);
    const prev = typeof stored === "number" ? stored : 0;
    attrs.set(key, prev + 1);
    return prev;
  }

  /** Atomically append to a list. Returns the new list. */
  stateAppend<T>(spanContext: SpanContext, key: string, item: T): T[] {
    const spanKey = makeSpanKey(spanContext);
    let attrs = this._state.get(spanKey);
    if (!attrs) {
      attrs = new Map();
      this._state.set(spanKey, attrs);
    }
    const stored = attrs.get(key);
    const list: T[] = Array.isArray(stored)
      ? [...(stored as T[]), item]
      : [item];
    attrs.set(key, list);
    return list;
  }

  private _emitSpan(span: ReadableSpan, isPartial = false): void {
    const ctx = span.spanContext();
    if (!ctx.traceId) return;
    const currId = this.stateIncr(ctx, AttributeKeys.JUDGMENT_UPDATE_ID);
    const attributes: Attributes = {
      ...span.attributes,
      [AttributeKeys.JUDGMENT_UPDATE_ID]: currId,
    };

    if (isPartial) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete attributes[AttributeKeys.JUDGMENT_PENDING_TRACE_EVAL];
    }

    const emittedSpan = Object.create(span) as ReadableSpan;
    Object.defineProperty(emittedSpan, "attributes", {
      value: attributes,
      writable: false,
    });
    const endTime = isZeroHrTime(span.endTime) ? span.startTime : span.endTime;
    Object.defineProperty(emittedSpan, "endTime", {
      value: endTime,
      writable: false,
    });

    super.onEnd(emittedSpan);
  }

  /**
   * Export a span's in-progress state for streaming updates. Defaults to the
   * current active span; pass an explicit span to snapshot one that is not
   * active (e.g. a long-lived root opened with `startSpan`).
   */
  emitPartial(span?: ApiSpan): void {
    dontThrow("JudgmentSpanProcessor.emitPartial", () => {
      const target = span ?? getTraceRuntime().getCurrentSpan();
      if (!target?.isRecording()) return;
      const ctx = target.spanContext();
      if (!ctx.traceId) return;
      if (
        this.stateGet<boolean>(
          ctx,
          InternalAttributeKeys.DISABLE_PARTIAL_EMIT,
          false,
        )
      ) {
        return;
      }
      this._emitSpan(target as unknown as ReadableSpan, true);
    });
  }

  onStart(span: Span, parentContext: Context): void {
    dontThrow("JudgmentSpanProcessor.onStart", () => {
      this._baggageProcessor.onStart(span, parentContext);
      this._registerSpan(span);
    });
  }

  onEnd(span: ReadableSpan): void {
    dontThrow("JudgmentSpanProcessor.onEnd", () => {
      const ctx = span.spanContext();
      if (!ctx.traceId) {
        super.onEnd(span);
        return;
      }
      const spanKey = makeSpanKey(ctx);
      try {
        const isCancelled = this.stateGet<boolean>(
          ctx,
          InternalAttributeKeys.CANCELLED,
          false,
        );
        if (!isCancelled) {
          this._emitSpan(span);
        }
      } finally {
        this._cleanupSpanState(spanKey);
      }
    });
  }
}
