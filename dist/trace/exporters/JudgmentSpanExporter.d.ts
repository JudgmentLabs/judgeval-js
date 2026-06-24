import type { ExportResult } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
/**
 * Span exporter that sends traces to the Judgment platform via OTLP HTTP.
 *
 * Wraps the OpenTelemetry OTLP trace exporter with Judgment-specific
 * authentication headers.
 */
export declare class JudgmentSpanExporter implements SpanExporter {
    protected _delegate: OTLPTraceExporter | null;
    /**
     * Create a new JudgmentSpanExporter.
     *
     * @param endpoint - The OTLP HTTP endpoint URL.
     * @param apiKey - Judgment API key for authentication.
     * @param organizationId - Judgment organization ID.
     * @param projectId - Judgment project ID.
     */
    constructor(endpoint: string, apiKey: string, organizationId: string, projectId: string);
    /**
     * Export a batch of spans.
     *
     * @param spans - The spans to export.
     * @param resultCallback - Callback invoked with the export result.
     */
    export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void;
    /**
     * Shut down the exporter.
     */
    shutdown(): Promise<void>;
    /**
     * Flush any pending exports.
     */
    forceFlush(): Promise<void>;
}
//# sourceMappingURL=JudgmentSpanExporter.d.ts.map