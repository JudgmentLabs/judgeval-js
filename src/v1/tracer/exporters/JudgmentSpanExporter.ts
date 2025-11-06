import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import type {
  ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import { SpanExporter } from "@opentelemetry/sdk-trace-base";
import * as AttributeKeys from "../attributeKeys";
import { type ExportResult } from "@opentelemetry/core";

export class JudgmentSpanExporter implements SpanExporter {
  private delegate: SpanExporter;

  constructor(
    endpoint: string,
    apiKey: string,
    organizationId: string,
    projectId: string,
  ) {
    this.delegate = new OTLPTraceExporter({
      url: endpoint,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Organization-Id": organizationId,
        [AttributeKeys.JUDGMENT_PROJECT_ID]: projectId,
      },
    });
  }

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    this.delegate.export(spans, resultCallback);
  }

  shutdown(): Promise<void> {
    return this.delegate.shutdown();
  }

  forceFlush(): Promise<void> {
    if ("forceFlush" in this.delegate && this.delegate.forceFlush) {
      return this.delegate.forceFlush();
    }
    return Promise.resolve();
  }
}

