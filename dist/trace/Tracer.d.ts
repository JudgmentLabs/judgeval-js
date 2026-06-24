import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { JudgmentApiClient } from "../internal/api";
import type { TracerConfig } from "./BaseTracer";
import { BaseTracer } from "./BaseTracer";
import { JudgmentSpanExporter } from "./exporters/JudgmentSpanExporter";
import { JudgmentSpanProcessor } from "./processors/JudgmentSpanProcessor";
/**
 * Concrete tracer implementation for Node.js applications.
 *
 * Use `Tracer.init()` to create and activate a new tracer. This sets up
 * OpenTelemetry span processing and export to the Judgment platform.
 *
 * @example
 * ```typescript
 * import { Tracer } from "judgeval";
 *
 * const tracer = await Tracer.init({ projectName: "my-project" });
 *
 * const traced = Tracer.observe(async (input: string) => {
 *   return await processInput(input);
 * });
 *
 * await traced("hello");
 * await Tracer.forceFlush();
 * await Tracer.shutdown();
 * ```
 */
export declare class Tracer extends BaseTracer {
    private _spanExporter;
    private _spanProcessor;
    protected constructor(projectName: string | null, projectId: string | null, apiKey: string | null, organizationId: string | null, apiUrl: string | null, environment: string | null, serializer: (v: unknown) => string, tracerProvider: NodeTracerProvider, client: JudgmentApiClient | null, enableMonitoring: boolean);
    /**
     * Create and activate a new Tracer.
     *
     * This is the recommended way to initialize tracing. Credentials are
     * read from environment variables if not provided explicitly.
     *
     * @param config - Tracer configuration options.
     * @returns A configured and activated `Tracer` instance.
     *
     * @example
     * ```typescript
     * const tracer = await Tracer.init({
     *   projectName: "my-project",
     *   environment: "production",
     * });
     * ```
     */
    static init(config?: TracerConfig): Promise<Tracer>;
    /**
     * Get or create the span exporter for this tracer.
     *
     * @returns The span exporter instance.
     */
    getSpanExporter(): JudgmentSpanExporter;
    /**
     * Get or create the span processor for this tracer.
     *
     * @returns The span processor instance.
     */
    getSpanProcessor(): JudgmentSpanProcessor;
}
//# sourceMappingURL=Tracer.d.ts.map