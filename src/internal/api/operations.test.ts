import { expect, test } from "bun:test";
import createClient from "openapi-fetch";
import { JudgmentApi } from "./operations";
import type { paths } from "./schema";

test("a generated method sends its route's method, path and body", async () => {
  let sent: Request | undefined;
  const api = new JudgmentApi(
    createClient<paths>({
      baseUrl: "https://api.test",
      fetch: async (request: Request) => {
        sent = request;
        return Response.json({ project_id: "p1" });
      },
    }),
  );

  await api.createProject({ body: { project_name: "demo" } });

  expect(sent?.method).toBe("POST");
  expect(sent?.url).toBe("https://api.test/v1/projects");
  expect(await sent?.json()).toEqual({ project_name: "demo" });
});

test("previous judge configuration methods keep their HTTP contracts", async () => {
  const requests: [string, string, unknown][] = [];
  const api = new JudgmentApi(
    createClient<paths>({
      baseUrl: "https://api.test",
      fetch: async (request: Request) => {
        requests.push([
          request.method,
          new URL(request.url).pathname,
          await request.json(),
        ]);
        return Response.json({});
      },
    }),
  );
  const params = {
    path: { projectId: "p", judgeId: "j", judgeVersionId: "v" },
  };
  await api.setJudgeOptimisticEvalEnabled({ params, body: { enabled: true } });
  await api.setJudgePreprocessorArtifactRevision({
    params,
    body: { preprocessor_artifact_revision_id: null },
  });
  expect(requests).toEqual([
    [
      "PUT",
      "/v1/projects/p/judges/j/versions/v/optimistic-eval",
      { enabled: true },
    ],
    [
      "PUT",
      "/v1/projects/p/judges/j/versions/v/preprocessor-artifact-revision",
      { preprocessor_artifact_revision_id: null },
    ],
  ]);
});
