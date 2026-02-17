import { ExportResultCode, type ExportResult } from "@opentelemetry/core";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { JudgmentSpanExporter } from "./JudgmentSpanExporter";

export class NoOpSpanExporter extends JudgmentSpanExporter {
  constructor() {
    super("", "", "", "");
    this._delegate = null;
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
