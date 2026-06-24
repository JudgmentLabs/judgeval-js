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
export declare class OfflineJudgmentSpanProcessor extends JudgmentSpanProcessor {
    private readonly _dataset;
    private readonly _exampleFields;
    private readonly _seenTraceIds;
    constructor(tracer: BaseTracer, exporter: SpanExporter, options: {
        dataset: Example[];
        exampleFields?: Record<string, unknown>;
    });
    private _maybeCreateExample;
    onEnd(span: ReadableSpan): void;
}
//# sourceMappingURL=OfflineJudgmentSpanProcessor.d.ts.map