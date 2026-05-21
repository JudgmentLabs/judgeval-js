import { ExportResultCode, type ExportResult } from "@opentelemetry/core";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { JudgmentSpanExporter } from "./JudgmentSpanExporter";

/**
 * A no-op span exporter that discards all spans.
 *
 * Used when monitoring is disabled or credentials are missing.
 */
export class NoOpSpanExporter extends JudgmentSpanExporter {
  constructor() {
    super("", "", "", "");
  }

  override export(
    _spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  override shutdown(): Promise<void> {
    return Promise.resolve();
  }

  override forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}
