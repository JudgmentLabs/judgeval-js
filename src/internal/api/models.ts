import type { components, paths } from "./schema";

type JsonContent<T> = T extends { content: { "application/json": infer B } }
  ? B
  : never;

/** JSON request body of a route in the committed public spec. */
export type RequestBody<
  P extends keyof paths,
  M extends keyof paths[P],
> = JsonContent<
  paths[P][M] extends { requestBody?: infer R } ? NonNullable<R> : never
>;

/** JSON 200 response of a route in the committed public spec. */
export type OkResponse<
  P extends keyof paths,
  M extends keyof paths[P],
> = JsonContent<
  paths[P][M] extends { responses: { 200: infer R } } ? R : never
>;

export type PendingEvalPayload = components["schemas"]["PendingEvalPayload"];
export type PullAllOfflineDatasetsResponse = OkResponse<
  "/v1/projects/{projectId}/datasets",
  "get"
>;
export type CreateTestConfigRequest = RequestBody<
  "/v1/projects/{projectId}/test-configs",
  "post"
>;
export type CreateTestRunRequest = RequestBody<
  "/v1/projects/{projectId}/test-runs",
  "post"
>;
export type PreparedTestRunResponse = OkResponse<
  "/v1/projects/{projectId}/test-runs",
  "post"
>;
export type ApplyTestRunSuccessRequest = RequestBody<
  "/v1/projects/{projectId}/test-runs/{testRunId}/success",
  "patch"
>;
export type ExampleEvaluationRun = RequestBody<
  "/v1/projects/{projectId}/eval-queue/examples",
  "post"
>;
export type Example = ExampleEvaluationRun["examples"][number];
export type LocalScorerResult = RequestBody<
  "/v1/projects/{projectId}/eval-results/examples",
  "post"
>["results"][number];
export type ExperimentResult = NonNullable<
  OkResponse<"/v1/projects/{projectId}/experiments/{runId}", "get">["results"]
>[number];
/** A legacy experiment row; the experiments route also serves test-run items. */
export type ExperimentRunItem = Extract<
  ExperimentResult,
  { experiment_run_id: string }
>;
export type ExperimentScorer = ExperimentRunItem["scorers"][number];

/** A dataset summary; part of the public SDK surface. */
export interface DatasetInfo {
  dataset_id: string;
  name: string;
  created_at: string;
  kind: string;
  entries: number;
  creator: string;
}

export type CreateJudgeRequest = RequestBody<
  "/v1/projects/{projectId}/judges",
  "post"
>;
export type UpdateJudgeRequest = RequestBody<
  "/v1/projects/{projectId}/judges/{judgeId}",
  "patch"
>;
export type JudgeVersionSelector = RequestBody<
  "/v1/projects/{projectId}/judges/{judgeId}/lookup",
  "post"
>["version"];
export type JudgeDetail = OkResponse<
  "/v1/projects/{projectId}/judges/{judgeId}/lookup",
  "post"
>["judge"];
