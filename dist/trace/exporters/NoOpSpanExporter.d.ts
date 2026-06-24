import { type ExportResult } from "@opentelemetry/core";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { JudgmentSpanExporter } from "./JudgmentSpanExporter";
/**
 * A no-op span exporter that discards all spans.
 *
 * Used when monitoring is disabled or credentials are missing.
 */
export declare class NoOpSpanExporter extends JudgmentSpanExporter {
    constructor();
    export(_spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void;
    shutdown(): Promise<void>;
    forceFlush(): Promise<void>;
}
//# sourceMappingURL=NoOpSpanExporter.d.ts.map