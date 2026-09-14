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

/**
 * Thrown when a JQL request is answered with HTTP 404.
 *
 * The public JQL API returns the same opaque 404 whether JQL is not enabled
 * for the organization or the project does not exist, so this error covers
 * both causes and its message names them. Distinct from a 503, which means
 * JQL is enabled but temporarily unavailable.
 */
export class JudgevalJqlUnavailableError extends JudgevalAPIError {
  constructor(
    status: number,
    code: string,
    message: string,
    hint = "",
    retryAfterSeconds?: number,
  ) {
    super(status, code, message, hint, retryAfterSeconds);
    this.name = "JudgevalJqlUnavailableError";
  }
}

/**
 * Message the API sends when a JQL-enabled organization asks for a project it
 * cannot see. Used only to sharpen the 404 message; an unrecognized message
 * falls back to naming both possible causes.
 */
const JQL_PROJECT_NOT_FOUND_MESSAGE = "Project not found";

export type JqlQueryInput = Query | QueryBuilder | PipelineBuilder;

function toQuery(input: JqlQueryInput): Query {
  return "toJSON" in input ? input.toJSON() : input;
}

export class JudgevalJqlClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly organizationId: string,
    private readonly projectId: string,
    private readonly projectName?: string,
  ) {}

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
    const response = await fetch(
      `${this.baseUrl.replace(/\/+$/, "")}/v1/projects/${encodeURIComponent(this.projectId)}/${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "X-Organization-Id": this.organizationId,
        },
        body: JSON.stringify({
          query,
          ...(options.limit === undefined ? {} : { limit: options.limit }),
          ...(options.traceIds === undefined
            ? {}
            : { trace_ids: options.traceIds }),
          ...(options.sessionIds === undefined
            ? {}
            : { session_ids: options.sessionIds }),
        }),
        signal: options.signal,
      },
    );
    const text = await response.text();
    if (!response.ok) {
      let payload: { error?: string; message?: string; hint?: string } = {};
      try {
        payload = JSON.parse(text) as typeof payload;
      } catch {
        // Preserve the response body below when the server did not return JSON.
      }
      const retryAfter = response.headers.get("Retry-After");
      const ErrorType =
        response.status === 404
          ? JudgevalJqlUnavailableError
          : JudgevalAPIError;
      throw new ErrorType(
        response.status,
        payload.error ?? `HTTP_${response.status}`,
        response.status === 404
          ? this.unavailableMessage(payload.message)
          : (payload.message ?? text),
        payload.hint ?? "",
        retryAfter === null ? undefined : Number(retryAfter),
      );
    }
    return JSON.parse(text) as T;
  }

  /**
   * Explain the opaque 404 the public JQL API returns.
   *
   * The organization-level feature gate runs before the project lookup
   * server-side, so a disabled organization never reaches the project check.
   * That makes the two 404 messages disjoint: only a JQL-enabled organization
   * can be told the project is missing. When the message is anything else,
   * either cause is possible and both are named.
   */
  private unavailableMessage(serverMessage?: string): string {
    const project = this.projectName ?? this.projectId;
    if (serverMessage === JQL_PROJECT_NOT_FOUND_MESSAGE) {
      return `Project '${project}' was not found for this organization.`;
    }
    return (
      `JQL is not enabled for this organization, or project '${project}' was ` +
      "not found — the API returns the same 404 for both. Contact Judgment to " +
      "enable JQL for your organization."
    );
  }
}
