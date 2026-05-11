import { JUDGMENT_API_KEY, JUDGMENT_API_URL, JUDGMENT_ORG_ID } from "./env";
import { JudgmentApiClient } from "./internal/api";
import { resolveProjectId } from "./utils/resolve-project-id";
import { EvaluationFactory } from "./evaluation/EvaluationFactory";
import { DatasetFactory } from "./datasets/DatasetFactory";
import type { OfflineTracer, OfflineTracerConfig } from "./trace/OfflineTracer";

/**
 * Options for {@link Judgeval.offlineTracer}.
 *
 * Mirrors `OfflineTracerConfig` minus credentials and `projectName`,
 * which are reused from the parent `Judgeval` instance.
 */
export type JudgevalOfflineTracerOptions = Omit<
  OfflineTracerConfig,
  "projectName" | "apiKey" | "organizationId" | "apiUrl"
>;

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
export class Judgeval {
  private readonly _client: JudgmentApiClient;
  private readonly _projectName: string;
  private readonly _projectId: string | null;

  private constructor(
    client: JudgmentApiClient,
    projectName: string,
    projectId: string | null,
  ) {
    this._client = client;
    this._projectName = projectName;
    this._projectId = projectId;
  }

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
  static async create(config: JudgevalConfig): Promise<Judgeval> {
    const apiKey = config.apiKey ?? JUDGMENT_API_KEY;
    const organizationId = config.organizationId ?? JUDGMENT_ORG_ID;
    const apiUrl = config.apiUrl ?? JUDGMENT_API_URL;

    if (!apiKey) {
      throw new Error("API key is required");
    }
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }
    if (!apiUrl) {
      throw new Error("API URL is required");
    }
    if (!config.projectName) {
      throw new Error("Project name is required");
    }

    const client = new JudgmentApiClient(apiUrl, apiKey, organizationId);
    let projectId: string | null = null;
    try {
      projectId = await resolveProjectId(client, config.projectName);
    } catch {
      console.warn(
        `Project '${config.projectName}' not found. ` +
          "Some operations requiring project_id will be skipped.",
      );
    }

    return new Judgeval(client, config.projectName, projectId);
  }

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
  async offlineTracer(
    options: JudgevalOfflineTracerOptions,
  ): Promise<OfflineTracer> {
    const { OfflineTracer } = await import("./trace/OfflineTracer");
    return OfflineTracer.create({
      ...options,
      projectName: this._projectName,
      apiKey: this._client.getApiKey(),
      organizationId: this._client.getOrganizationId(),
      apiUrl: this._client.getBaseUrl(),
    });
  }

  /** Access dataset management (create, get, list). */
  get datasets(): DatasetFactory {
    return new DatasetFactory(this._client, this._projectId, this._projectName);
  }

  /** Access evaluation (create evaluation runs). */
  get evaluation(): EvaluationFactory {
    return new EvaluationFactory(
      this._client,
      this._projectId,
      this._projectName,
    );
  }
}
