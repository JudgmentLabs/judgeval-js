import createClient from "openapi-fetch";
import type { RequestBody } from "./models";
import type { paths } from "./schema";

/** Typed client for the /v1 routes the SDK calls, checked against the committed spec. */
export class JudgmentApiClient {
  readonly api: ReturnType<typeof createClient<paths>>;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly organizationId: string,
  ) {
    this.api = createClient<paths>({
      baseUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Organization-Id": organizationId,
      },
    });
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
  getApiKey(): string {
    return this.apiKey;
  }
  getOrganizationId(): string {
    return this.organizationId;
  }

  postV1projectsResolve(payload: RequestBody<"/v1/projects/resolve/", "post">) {
    return ok(this.api.POST("/v1/projects/resolve/", { body: payload }));
  }

  postV1projectsDatasets(
    projectId: string,
    payload: RequestBody<"/v1/projects/{projectId}/datasets", "post">,
  ) {
    return ok(
      this.api.POST("/v1/projects/{projectId}/datasets", {
        params: { path: { projectId } },
        body: payload,
      }),
    );
  }

  getV1projectsDatasets(projectId: string) {
    return ok(
      this.api.GET("/v1/projects/{projectId}/datasets", {
        params: { path: { projectId } },
      }),
    );
  }

  getV1projectsDatasetsByDatasetIdentifier(
    projectId: string,
    datasetIdentifier: string,
  ) {
    return ok(
      this.api.GET("/v1/projects/{projectId}/datasets/{datasetIdentifier}", {
        params: { path: { projectId, datasetIdentifier } },
      }),
    );
  }

  postV1projectsDatasetsByDatasetIdentifierExamples(
    projectId: string,
    datasetIdentifier: string,
    payload: RequestBody<
      "/v1/projects/{projectId}/datasets/{datasetIdentifier}/examples",
      "post"
    >,
  ) {
    return ok(
      this.api.POST(
        "/v1/projects/{projectId}/datasets/{datasetIdentifier}/examples",
        { params: { path: { projectId, datasetIdentifier } }, body: payload },
      ),
    );
  }

  getV1projectsDatasetsByDatasetIdentifierVersions(
    projectId: string,
    datasetIdentifier: string,
  ) {
    return ok(
      this.api.GET(
        "/v1/projects/{projectId}/datasets/{datasetIdentifier}/versions",
        { params: { path: { projectId, datasetIdentifier } } },
      ),
    );
  }

  getV1projectsDatasetsByDatasetIdentifierPage(
    projectId: string,
    datasetIdentifier: string,
    version?: number,
    limit?: number,
    cursor_created_at?: string,
    cursor_example_id?: string,
  ) {
    return ok(
      this.api.GET(
        "/v1/projects/{projectId}/datasets/{datasetIdentifier}/page",
        {
          params: {
            path: { projectId, datasetIdentifier },
            query: { version, limit, cursor_created_at, cursor_example_id },
          },
        },
      ),
    );
  }

  getV1projectsExperimentsByRunId(projectId: string, runId: string) {
    return ok(
      this.api.GET("/v1/projects/{projectId}/experiments/{runId}", {
        params: { path: { projectId, runId } },
      }),
    );
  }

  postV1projectsEvalResultsExamples(
    projectId: string,
    payload: RequestBody<
      "/v1/projects/{projectId}/eval-results/examples",
      "post"
    >,
  ) {
    return ok(
      this.api.POST("/v1/projects/{projectId}/eval-results/examples", {
        params: { path: { projectId } },
        body: payload,
      }),
    );
  }

  postV1projectsEvalQueueExamples(
    projectId: string,
    payload: RequestBody<
      "/v1/projects/{projectId}/eval-queue/examples",
      "post"
    >,
  ) {
    return ok(
      this.api.POST("/v1/projects/{projectId}/eval-queue/examples", {
        params: { path: { projectId } },
        body: payload,
      }),
    );
  }

  /**
   * Returns the raw result rather than throwing, so the caller can read the
   * status and `Retry-After` of a failed request to decide whether to retry.
   */
  postV1projectsObservations(
    projectId: string,
    payload: RequestBody<"/v1/projects/{projectId}/observations", "post">,
    signal?: AbortSignal,
  ) {
    return this.api.POST("/v1/projects/{projectId}/observations", {
      params: { path: { projectId } },
      body: payload,
      signal,
    });
  }

  postV1projectsTracesByTraceIdTags(
    projectId: string,
    traceId: string,
    payload: RequestBody<
      "/v1/projects/{projectId}/traces/{traceId}/tags",
      "post"
    >,
  ) {
    return ok(
      this.api.POST("/v1/projects/{projectId}/traces/{traceId}/tags", {
        params: { path: { projectId, traceId } },
        body: payload,
      }),
    );
  }

  postV1projectsJudges(
    projectId: string,
    payload: RequestBody<"/v1/projects/{projectId}/judges", "post">,
  ) {
    return ok(
      this.api.POST("/v1/projects/{projectId}/judges", {
        params: { path: { projectId } },
        body: payload,
      }),
    );
  }

  postV1projectsJudgeResults(
    projectId: string,
    payload: RequestBody<"/v1/projects/{projectId}/judge-results", "post">,
  ) {
    return ok(
      this.api.POST("/v1/projects/{projectId}/judge-results", {
        params: { path: { projectId } },
        body: payload,
      }),
    );
  }

  patchV1projectsJudgesByJudgeId(
    projectId: string,
    judgeId: string,
    payload: RequestBody<"/v1/projects/{projectId}/judges/{judgeId}", "patch">,
  ) {
    return ok(
      this.api.PATCH("/v1/projects/{projectId}/judges/{judgeId}", {
        params: { path: { projectId, judgeId } },
        body: payload,
      }),
    );
  }

  postV1projectsJudgesByJudgeIdLookup(
    projectId: string,
    judgeId: string,
    payload: RequestBody<
      "/v1/projects/{projectId}/judges/{judgeId}/lookup",
      "post"
    >,
  ) {
    return ok(
      this.api.POST("/v1/projects/{projectId}/judges/{judgeId}/lookup", {
        params: { path: { projectId, judgeId } },
        body: payload,
      }),
    );
  }
}

/** Returns the response data, throwing `HTTP <status>: <body>` on failure. */
export async function ok<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await request;
  if (!response.ok) {
    const body = typeof error === "string" ? error : JSON.stringify(error);
    throw new Error(`HTTP ${response.status}: ${body}`);
  }
  return data as T;
}
