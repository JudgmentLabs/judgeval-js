import type { ExportResult } from "@opentelemetry/core";
import { ExportResultCode } from "@opentelemetry/core";
import { ProtobufTraceSerializer } from "@opentelemetry/otlp-transformer";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";

// Workers fetch exports complete asynchronously, so forceFlush reads and
// surfaces any export failure recorded by the exporter.
export interface ExportErrorSource {
  takeExportError(): Error | undefined;
}

export class WorkerSpanExporter implements SpanExporter, ExportErrorSource {
  private readonly _exportErrors: Error[] = [];

  constructor(
    private readonly _endpoint: string,
    private readonly _apiKey: string,
    private readonly _organizationId: string,
    private readonly _projectId: string,
  ) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    const body = ProtobufTraceSerializer.serializeRequest(spans);
    if (!body) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    fetch(this._endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this._apiKey}`,
        "Content-Type": "application/x-protobuf",
        "X-Organization-Id": this._organizationId,
        "X-Project-Id": this._projectId,
      },
      body,
    })
      .then(async (res) => {
        if (res.ok) {
          resultCallback({ code: ExportResultCode.SUCCESS });
          return;
        }

        const detail = (await res.text().catch(() => "")).slice(0, 500);
        const error = new Error(
          detail
            ? `OTLP export failed: ${res.status}: ${detail}`
            : `OTLP export failed: ${res.status}`,
        );
        this._exportErrors.push(error);
        resultCallback({ code: ExportResultCode.FAILED, error });
      })
      .catch((error: unknown) => {
        const normalized =
          error instanceof Error ? error : new Error(String(error));
        this._exportErrors.push(normalized);
        resultCallback({ code: ExportResultCode.FAILED, error: normalized });
      });
  }

  takeExportError(): Error | undefined {
    return this._exportErrors.shift();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    const error = this.takeExportError();
    if (error) {
      return Promise.reject(error);
    }
    return Promise.resolve();
  }
}
