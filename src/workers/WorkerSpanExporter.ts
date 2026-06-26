import type { ExportResult } from "@opentelemetry/core";
import { ExportResultCode } from "@opentelemetry/core";
import { ProtobufTraceSerializer } from "@opentelemetry/otlp-transformer";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";

/**
 * Fetch-based OTLP/protobuf span exporter for Cloudflare Workers.
 *
 * Export outcomes (including failures) are reported through `resultCallback`,
 * which the span processor consumes. The processor's `forceFlush` drives the
 * actual flush — the exporter is stateless and keeps no error queue.
 */
export class WorkerSpanExporter implements SpanExporter {
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
        resultCallback({
          code: ExportResultCode.FAILED,
          error: new Error(
            detail
              ? `OTLP export failed: ${res.status}: ${detail}`
              : `OTLP export failed: ${res.status}`,
          ),
        });
      })
      .catch((error: unknown) => {
        resultCallback({
          code: ExportResultCode.FAILED,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
