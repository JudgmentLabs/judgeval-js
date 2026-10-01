import type {
  DiscoveryKind,
  DiscoveryOptions,
  PipelineBuilder,
  QueryBuilder,
} from "./builder";
import { discovery } from "./builder";
import type { PresentationQuery, Query } from "./wire";
import type { components as PublicComponents } from "./generated/public-api";

export interface JqlRequestOptions {
  limit?: number;
  /** Narrow the query directly to these traces. Mutually exclusive with sessionIds. */
  traceIds?: string[];
  /** Narrow the query to traces resolved from these sessions. */
  sessionIds?: string[];
  signal?: AbortSignal;
}

type PublicSchemas = PublicComponents["schemas"];
export type JqlQueryResponse = PublicSchemas["PublicJqlQueryResponse"];
export type JqlPresentationResponse =
  PublicSchemas["PublicJqlPresentationResponse"];
/** SQL columns and rows, with unsafe integers represented as decimal strings. */
export type SqlResponse = PublicSchemas["PublicSqlResponse"];

export class JudgevalAPIError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly hint = "",
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "JudgevalAPIError";
  }
}

export type JqlQueryInput = Query | QueryBuilder | PipelineBuilder;

function toQuery(input: JqlQueryInput): Query {
  return "toJSON" in input ? input.toJSON() : input;
}

/** Authenticated transport shared by SQL and legacy JQL queries. */
export class JudgevalQueryClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly organizationId: string,
    private readonly projectId: string | null,
  ) {}

  /** Fetches the generated Markdown reference shared with MCP discover_schema. */
  async discoverSchema(
    options: { signal?: AbortSignal } = {},
  ): Promise<string> {
    const response = await this.request<
      PublicSchemas["PublicSqlSchemaResponse"]
    >("GET", "/v1/sql/schema", undefined, options.signal);
    return response.schema;
  }

  /** Executes one read-only SELECT against the project's SQL catalog. */
  sql(
    sql: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<SqlResponse> {
    return this.request(
      "POST",
      this.projectPath("sql"),
      { sql },
      options.signal,
    );
  }

  private projectPath(path: string): string {
    if (!this.projectId) {
      throw new Error("Project must resolve before running queries.");
    }
    return `/v1/projects/${encodeURIComponent(this.projectId)}/${path}`;
  }

  query(
    query: JqlQueryInput,
    options: JqlRequestOptions = {},
  ): Promise<JqlQueryResponse> {
    return this.post("query", toQuery(query), options);
  }

  present(
    query: PresentationQuery,
    options: JqlRequestOptions = {},
  ): Promise<JqlPresentationResponse> {
    return this.post("query/presentation", query, options);
  }

  discover(
    kind: DiscoveryKind,
    options: DiscoveryOptions & JqlRequestOptions = {},
  ): Promise<JqlQueryResponse> {
    const { signal, traceIds, sessionIds, ...discoveryOptions } = options;
    return this.query(discovery(kind, discoveryOptions), {
      limit: options.limit,
      traceIds,
      sessionIds,
      signal,
    });
  }

  private async post<T>(
    path: string,
    query: Query | PresentationQuery,
    options: JqlRequestOptions,
  ): Promise<T> {
    if (options.traceIds !== undefined && options.sessionIds !== undefined) {
      throw new TypeError("traceIds and sessionIds are mutually exclusive");
    }
    return await this.request(
      "POST",
      this.projectPath(path),
      {
        query,
        ...(options.limit === undefined ? {} : { limit: options.limit }),
        ...(options.traceIds === undefined
          ? {}
          : { trace_ids: options.traceIds }),
        ...(options.sessionIds === undefined
          ? {}
          : { session_ids: options.sessionIds }),
      },
      options.signal,
    );
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "X-Organization-Id": this.organizationId,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    const text = await response.text();
    if (!response.ok) {
      let payload: { error?: string; message?: string; hint?: string } = {};
      try {
        payload = JSON.parse(text) as typeof payload;
      } catch {
        // Preserve the response body below when the server did not return JSON.
      }
      const retryAfter = response.headers.get("Retry-After");
      throw new JudgevalAPIError(
        response.status,
        payload.error ?? `HTTP_${response.status}`,
        payload.message ?? text,
        payload.hint ?? "",
        retryAfter === null ? undefined : Number(retryAfter),
      );
    }
    return JSON.parse(text) as T;
  }
}
