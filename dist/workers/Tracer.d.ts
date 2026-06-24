import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { JudgmentApiClient } from "../internal/api";
import { BaseTracer, type TracerConfig } from "../trace/BaseTracer";
import { JudgmentSpanExporter } from "../trace/exporters/JudgmentSpanExporter";
import { JudgmentSpanProcessor } from "../trace/processors/JudgmentSpanProcessor";
export interface WorkersTracerConfig extends Omit<TracerConfig, "apiKey" | "apiUrl" | "organizationId" | "projectName"> {
    /** Your Judgment project name. Required when projectId is not provided. */
    projectName?: string;
    /** Pre-resolved Judgment project ID. Prefer this in Workers to avoid an init-time API lookup. */
    projectId?: string;
    /** Judgment API key. Required; Workers do not read process.env. */
    apiKey: string;
    /** Judgment organization ID. Required; Workers do not read process.env. */
    organizationId: string;
    /** Judgment API URL. Required; Workers do not read process.env. */
    apiUrl: string;
}
export declare class Tracer extends BaseTracer {
    private _spanExporter;
    private _spanProcessor;
    protected constructor(projectName: string | null, projectId: string, apiKey: string, organizationId: string, apiUrl: string, environment: string | null, serializer: (v: unknown) => string, tracerProvider: WebTracerProvider, client: JudgmentApiClient);
    static init(config: WorkersTracerConfig): Promise<Tracer>;
    getSpanExporter(): JudgmentSpanExporter;
    getSpanProcessor(): JudgmentSpanProcessor;
}
//# sourceMappingURL=Tracer.d.ts.map