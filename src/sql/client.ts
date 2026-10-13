/** SQL columns and rows, with unsafe integers represented as decimal strings. */
export interface SqlResponse {
  catalog_version: string;
  columns: { name: string; type: string; nullable: boolean }[];
  /** SQL integers outside the JavaScript safe range (-(2^53 - 1) to 2^53 - 1) are returned as exact decimal strings, including in nested values. Column types retain the original SQL types. */
  rows: Record<string, unknown>[];
  row_count: number;
  elapsed_ms: number;
}

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

/** Authenticated transport for SQL queries and schema discovery. */
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
    const response = await this.request<{ schema: string }>(
      "GET",
      "/v1/sql/schema",
      undefined,
      options.signal,
    );
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
