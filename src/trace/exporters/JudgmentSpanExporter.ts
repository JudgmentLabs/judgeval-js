import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import type { ExportResult } from "@opentelemetry/core";
import { Logger } from "../../utils/logger";

export class JudgmentSpanExporter implements SpanExporter {
  protected _delegate: OTLPTraceExporter | null;

  constructor(
    endpoint: string,
    apiKey: string,
    organizationId: string,
    projectId: string,
  ) {
    this._delegate = new OTLPTraceExporter({
      url: endpoint,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Organization-Id": organizationId,
        "X-Project-Id": projectId,
      },
    });
  }

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    Logger.info(`Exported ${spans.length} spans`);
    this._delegate?.export(spans, resultCallback);
  }

  shutdown(): Promise<void> {
    return this._delegate?.shutdown() ?? Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return this._delegate?.forceFlush() ?? Promise.resolve();
  }
}
