import type { ExportResult } from "@opentelemetry/core";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { JudgmentSpanExporter } from "../trace/exporters/JudgmentSpanExporter";
export declare class WorkerSpanExporter extends JudgmentSpanExporter {
    private readonly _endpoint;
    private readonly _apiKey;
    private readonly _organizationId;
    private readonly _projectId;
    private readonly _exportErrors;
    constructor(_endpoint: string, _apiKey: string, _organizationId: string, _projectId: string);
    export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void;
    takeExportError(): Error | undefined;
    shutdown(): Promise<void>;
    forceFlush(): Promise<void>;
}
//# sourceMappingURL=WorkerSpanExporter.d.ts.map