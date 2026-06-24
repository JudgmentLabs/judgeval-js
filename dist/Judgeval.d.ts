import { EvaluationFactory } from "./evaluation/EvaluationFactory";
import { DatasetFactory } from "./datasets/DatasetFactory";
import { AgentJudgeFactory } from "./agent-judges/AgentJudgeFactory";
import type { OfflineTracer, OfflineTracerConfig } from "./trace/OfflineTracer";
/**
 * Options for {@link Judgeval.offlineTracer}.
 * Credentials and `projectName` are taken from the parent `Judgeval` instance.
 */
export type JudgevalOfflineTracerOptions = Omit<OfflineTracerConfig, "projectName" | "apiKey" | "organizationId" | "apiUrl">;
/**
 * Configuration options for the Judgeval client.
 *
 * Credentials are resolved in order: explicit arguments first, then
 * environment variables `JUDGMENT_API_KEY`, `JUDGMENT_ORG_ID`, and
 * `JUDGMENT_API_URL`.
 */
export interface JudgevalConfig {
    /** The project name on the Judgment platform. */
    projectName: string;
    /** Judgment API key. Defaults to `JUDGMENT_API_KEY` env var. */
    apiKey?: string;
    /** Judgment organization ID. Defaults to `JUDGMENT_ORG_ID` env var. */
    organizationId?: string;
    /** Judgment API URL. Defaults to `JUDGMENT_API_URL` env var. */
    apiUrl?: string;
}
/**
 * The main entry point for interacting with the Judgment platform.
 *
 * `Judgeval` connects to your Judgment project and gives you access to
 * evaluation, datasets, and monitoring through the Judgment platform.
 *
 * @example
 * ```typescript
 * import { Judgeval } from "judgeval";
 *
 * const client = await Judgeval.create({ projectName: "my-project" });
 * ```
 *
 * @throws Error if any required credential is missing.
 */
export declare class Judgeval {
    private readonly _client;
    private readonly _projectName;
    private readonly _projectId;
    private constructor();
    /**
     * Create a new Judgeval client instance.
     *
     * Resolves the `projectName` to a `projectId` via the Judgment API.
     *
     * @param config - Configuration options. Credentials default to environment variables.
     * @returns A new `Judgeval` instance.
     *
     * @example
     * ```typescript
     * const client = await Judgeval.create({
     *   projectName: "my-project",
     *   apiKey: "<your-api-key>",
     *   organizationId: "<your-organization-id>",
     * });
     * ```
     */
    static create(config: JudgevalConfig): Promise<Judgeval>;
    /**
     * Create and activate an `OfflineTracer` for this project.
     *
     * Reuses the credentials supplied to this `Judgeval` instance. Each
     * completed root span appends an `Example` to `dataset`, carrying
     * the offline trace id and the static `exampleFields`.
     *
     * @example
     * ```typescript
     * const judgeval = await Judgeval.create({ projectName: "my-project" });
     * const dataset: Example[] = [];
     * const tracer = await judgeval.offlineTracer({
     *   dataset,
     *   exampleFields: { input: item.input, golden_output: item.goldenOutput },
     * });
     * ```
     */
    offlineTracer(options: JudgevalOfflineTracerOptions): Promise<OfflineTracer>;
    /** Access dataset management (create, get, list). */
    get datasets(): DatasetFactory;
    /** Access evaluation (create evaluation runs). */
    get evaluation(): EvaluationFactory;
    /** Manage Agent Judges (prompt-based scorers) on the platform. */
    get agentJudges(): AgentJudgeFactory;
}
//# sourceMappingURL=Judgeval.d.ts.map