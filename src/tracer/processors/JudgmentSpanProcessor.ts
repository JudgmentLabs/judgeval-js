import {
  BatchSpanProcessor,
  type BatchSpanProcessorBrowserConfig,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import type { BaseTracer } from "../BaseTracer";

export interface JudgmentSpanProcessorConfig {
  maxQueueSize?: number;
  scheduledDelayMillis?: number;
  maxExportBatchSize?: number;
  exportTimeoutMillis?: number;
}

export class JudgmentSpanProcessor extends BatchSpanProcessor {
  // The span processor does have custom functionality that at the moment is not ported over and still in discussion.
  // Current implementation enforces that tracer will always exist for predicted compatibility in the future.
  private tracer: BaseTracer;
  constructor(
    _tracer: BaseTracer,
    exporter: SpanExporter,
    config?: JudgmentSpanProcessorConfig,
  ) {
    const batchConfig: BatchSpanProcessorBrowserConfig = {
      maxQueueSize: config?.maxQueueSize,
      scheduledDelayMillis: config?.scheduledDelayMillis,
      maxExportBatchSize: config?.maxExportBatchSize,
      exportTimeoutMillis: config?.exportTimeoutMillis,
    };
    super(exporter, batchConfig);
    this.tracer = _tracer;
  }
}
