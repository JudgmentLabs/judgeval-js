import { JUDGMENT_API_KEY, JUDGMENT_API_URL, JUDGMENT_ORG_ID } from "./env";
import { JudgmentApiClient } from "./internal/api";
import { resolveProjectId } from "./utils/resolve-project-id";
import { Logger } from "./utils/logger";
import { EvaluationFactory } from "./evaluation/EvaluationFactory";
import { DatasetFactory } from "./datasets/DatasetFactory";
import { AgentJudgeFactory } from "./agent-judges/AgentJudgeFactory";
import { OfflineTestsFactory } from "./offline-tests/OfflineTestsFactory";
import type { OfflineTracer, OfflineTracerConfig } from "./trace/OfflineTracer";
import {
  JudgevalQueryClient,
  type JqlPresentationResponse,
  type JqlQueryInput,
  type JqlQueryResponse,
  type JqlRequestOptions,
  type SqlResponse,
} from "./jql/client";
import type { DiscoveryKind, DiscoveryOptions } from "./jql/builder";
import type { PresentationQuery } from "./jql/wire";

/**
 * Options for {@link Judgeval.offlineTracer}.
 * Credentials and `projectName` are taken from the parent `Judgeval` instance.
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
 * SQL queries, evaluations, datasets, and monitoring.
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
      Logger.warning(
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

  /**
   * Returns the server's SQL reference as Markdown, matching MCP
   * discover_schema: tables, columns, descriptions, examples, and limits.
   * Requires organization viewer access, but no resolved project or query opt-in.
   *
   * @param options - Pass `signal` to cancel the request with an AbortSignal.
   * @returns The virtual schema reference as a Markdown string; no project data.
   *
   * @example
   * ```typescript
   * console.log(await client.discoverSchema());
   * ```
   */
  discoverSchema(options?: { signal?: AbortSignal }): Promise<string> {
    return this.queryClient().discoverSchema(options);
  }

  /**
   * Runs one read-only SQL SELECT for this organization and project.
   *
   * The server derives scope from the client's credentials and resolved project.
   * Call `discoverSchema()` for supported tables and columns. Requires viewer
   * access and public SDK/API queries enabled for the organization.
   *
   * Results are capped at 1,000 rows and 5 MiB; exceeding either cap returns an
   * error. Use SQL predicates and LIMIT to narrow results. Integers outside
   * JavaScript's safe range arrive as exact decimal strings.
   *
   * @param sql - One SELECT against the virtual schema, at most 50,000 characters.
   * @param options - Pass `signal` to cancel the request with an AbortSignal.
   * @returns An object with `catalog_version`, `columns` (name, type, nullable),
   * `rows` (objects keyed by column name), `row_count`, and `elapsed_ms`.
   *
   * @example
   * ```typescript
   * const result = await client.sql("SELECT count() AS run_count FROM telemetry.traces");
   * console.log(result.rows);
   * ```
   */
  sql(sql: string, options?: { signal?: AbortSignal }): Promise<SqlResponse> {
    return this.queryClient().sql(sql, options);
  }

  /**
   * Runs a legacy JQL query.
   *
   * **Deprecated.** Use [`sql()`](#sql) for new integrations, with SQL
   * predicates to narrow results. Existing JQL calls remain supported.
   */
  query(
    query: JqlQueryInput,
    options?: JqlRequestOptions,
  ): Promise<JqlQueryResponse> {
    return this.queryClient().query(query, options);
  }

  /**
   * Runs a legacy JQL chart or table query.
   *
   * **Deprecated.** Use [`sql()`](#sql) for new queries and render its
   * rows as charts or tables in your application. SQL does not return a
   * JQL presentation frame. Existing presentation calls and their frame
   * responses remain supported.
   */
  present(
    query: PresentationQuery,
    options?: JqlRequestOptions,
  ): Promise<JqlPresentationResponse> {
    return this.queryClient().present(query, options);
  }

  /**
   * Discovers project-scoped judges, fields, models, and related values.
   *
   * **Deprecated.** Use [`discoverSchema()`](#discoverschema) to inspect
   * the SQL tables and columns, then [`sql()`](#sql) to query project values.
   * Schema discovery returns documentation, not project data. Existing
   * JQL discovery calls remain supported; SQL returns a different row schema.
   */
  discover(
    kind: DiscoveryKind,
    options?: DiscoveryOptions & JqlRequestOptions,
  ): Promise<JqlQueryResponse> {
    return this.queryClient().discover(kind, options);
  }

  private queryClient(): JudgevalQueryClient {
    return new JudgevalQueryClient(
      this._client.getBaseUrl(),
      this._client.getApiKey(),
      this._client.getOrganizationId(),
      this._projectId,
    );
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

  /** Manage Agent Judges (prompt-based scorers) on the platform. */
  get agentJudges(): AgentJudgeFactory {
    return new AgentJudgeFactory(
      this._client,
      this._projectId,
      this._projectName,
    );
  }

  /** Create test configs and run offline tests (dataset + judges). */
  get offlineTests(): OfflineTestsFactory {
    return new OfflineTestsFactory(
      this._client,
      this._projectId,
      this._projectName,
    );
  }
}
