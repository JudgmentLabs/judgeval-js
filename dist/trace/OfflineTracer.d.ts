import type { Sampler, SpanLimits } from "@opentelemetry/sdk-trace-base";
import { type SpanProcessor } from "@opentelemetry/sdk-trace-base";
import type { Example } from "../data/Example";
import { Tracer } from "./Tracer";
import { JudgmentSpanExporter } from "./exporters/JudgmentSpanExporter";
import { OfflineJudgmentSpanProcessor } from "./processors/OfflineJudgmentSpanProcessor";
/**
 * Configuration for `OfflineTracer.create()`.
 */
export interface OfflineTracerConfig {
    /** List that receives an `Example` for each completed root span. */
    dataset: Example[];
    /**
     * Fields included on every `Example` in `dataset`
     * (e.g. `{ input: ..., goldenOutput: ... }`).
     */
    exampleFields?: Record<string, unknown>;
    /** Your Judgment project name. Required. */
    projectName?: string;
    /** Judgment API key. Defaults to `JUDGMENT_API_KEY` env var. */
    apiKey?: string;
    /** Judgment organization ID. Defaults to `JUDGMENT_ORG_ID` env var. */
    organizationId?: string;
    /** Judgment API URL. Defaults to `JUDGMENT_API_URL` env var. */
    apiUrl?: string;
    /** Deployment environment name (e.g. "production"). */
    environment?: string;
    /** Whether to set this tracer as active. Defaults to `true`. */
    setActive?: boolean;
    /** Custom serialization function for span attribute values. */
    serializer?: (value: unknown) => string;
    /** Additional OpenTelemetry resource attributes. */
    resourceAttributes?: Record<string, string>;
    /** Custom OpenTelemetry sampler. */
    sampler?: Sampler;
    /** Custom OpenTelemetry span limits. */
    spanLimits?: SpanLimits;
    /** Additional OpenTelemetry span processors. */
    spanProcessors?: SpanProcessor[];
}
/**
 * Tracer for offline / experiment-style runs.
 *
 * Behaves like `Tracer` for span creation and `@Tracer.observe`, with
 * two differences:
 *
 * * Spans are pushed to the project's *offline* OTLP endpoint and stored
 *   in the `offline_otel_traces` ClickHouse table. They do **not** appear
 *   on the live monitoring page.
 * * Each completed root span produces a new `Example` that is appended
 *   to the caller-supplied `dataset` list. The example carries the
 *   `offline_trace_id` of the offline trace plus any static
 *   `exampleFields` configured at init time.
 *
 * Unlike `Tracer`, `OfflineTracer` requires all credentials upfront and
 * throws if any are missing — there is no no-op fallback. Prefer
 * `judgeval.offlineTracer({ ... })` over calling `OfflineTracer.create`
 * directly so credentials are reused from the active `Judgeval` client.
 *
 * @example
 * ```typescript
 * import { Judgeval, type Example } from "judgeval";
 *
 * const judgeval = await Judgeval.create({ projectName: "my-project" });
 * const dataset: Example[] = [];
 * const tracer = await judgeval.offlineTracer({
 *   dataset,
 *   exampleFields: { input: "What is 2+2?", expected_output: "4" },
 * });
 * ```
 */
export declare class OfflineTracer extends Tracer {
    readonly supportsLiveInstrumentation: boolean;
    private readonly _offlineApiUrl;
    private readonly _offlineApiKey;
    private readonly _offlineOrganizationId;
    private readonly _offlineProjectId;
    private readonly _dataset;
    private readonly _exampleFields;
    private _offlineSpanExporter;
    private _offlineSpanProcessor;
    private constructor();
    /**
     * Create and activate a new `OfflineTracer`.
     *
     * @throws Error if `projectName`, `apiKey`, `organizationId`, or
     *   `apiUrl` cannot be resolved (explicit arg or env var), or if the
     *   project cannot be found on the backend.
     */
    static create(config: OfflineTracerConfig): Promise<OfflineTracer>;
    /**
     * Return the offline span exporter for this tracer.
     *
     * Targets the project's offline OTLP endpoint. Credentials are
     * guaranteed present (validated in `create`).
     */
    getSpanExporter(): JudgmentSpanExporter;
    /** Return the offline span processor for this tracer. */
    getSpanProcessor(): OfflineJudgmentSpanProcessor;
}
//# sourceMappingURL=OfflineTracer.d.ts.map