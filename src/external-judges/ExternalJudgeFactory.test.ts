import { describe, expect, test, mock } from "bun:test";
import { ExternalJudgeFactory } from "./ExternalJudgeFactory";
import { JudgmentApiClient } from "../internal/api/client";

interface FakeClient {
  postV1projectsJudges: ReturnType<typeof mock>;
  postV1projectsJudgeResults: ReturnType<typeof mock>;
}

function makeFactory(projectId: string | null = "proj-1") {
  const client: FakeClient = {
    postV1projectsJudges: mock(),
    postV1projectsJudgeResults: mock(),
  };
  const factory = new ExternalJudgeFactory(
    client as unknown as JudgmentApiClient,
    projectId,
    "test-project",
  );
  return { factory, client };
}

describe("ExternalJudgeFactory.create", () => {
  test("returns an ExternalJudge on success", async () => {
    const { factory, client } = makeFactory();
    client.postV1projectsJudges.mockResolvedValueOnce({
      judge_id: "judge-1",
      judge_version_id: "version-1",
      implementation_id: null,
    });

    const result = await factory.create({
      name: "human-thumbs-up",
      scoreType: "binary",
    });

    expect(result).not.toBeNull();
    expect(result?.judgeId).toBe("judge-1");
  });

  test("sends the binary payload shape", async () => {
    const { factory, client } = makeFactory();
    client.postV1projectsJudges.mockResolvedValueOnce({
      judge_id: "judge-1",
      judge_version_id: "version-1",
      implementation_id: null,
    });

    await factory.create({ name: "n", scoreType: "binary" });

    const call = client.postV1projectsJudges.mock.calls[0];
    const payload = call[1] as Record<string, unknown>;
    expect(payload).toEqual({
      judge: {
        name: "n",
        executionMode: "external",
        initialVersion: { scoreType: "binary" },
      },
    });
  });

  test("includes categorical outputs in the payload", async () => {
    const { factory, client } = makeFactory();
    client.postV1projectsJudges.mockResolvedValueOnce({
      judge_id: "judge-1",
      judge_version_id: "version-1",
      implementation_id: null,
    });
    const outputs = [
      { name: "good", description: "Good response" },
      { name: "bad", description: "Bad response" },
    ];

    await factory.create({ name: "n", scoreType: "categorical", outputs });

    const call = client.postV1projectsJudges.mock.calls[0];
    const payload = call[1] as Record<string, unknown>;
    expect((payload.judge as Record<string, unknown>).initialVersion).toEqual({
      scoreType: "categorical",
      outputs,
    });
  });

  test("throws when a categorical judge is missing outputs", async () => {
    const { factory } = makeFactory();

    await expect(
      factory.create({ name: "n", scoreType: "categorical" }),
    ).rejects.toThrow(/outputs/);
  });

  test("throws when a non-categorical judge is given outputs", async () => {
    const { factory } = makeFactory();

    await expect(
      factory.create({
        name: "n",
        scoreType: "binary",
        outputs: [{ name: "good", description: "" }],
      }),
    ).rejects.toThrow(/categorical/);
  });

  test("returns null when the project is unresolved", async () => {
    const { factory } = makeFactory(null);

    const result = await factory.create({ name: "n", scoreType: "binary" });

    expect(result).toBeNull();
  });
});

describe("ExternalJudgeFactory.submitResult", () => {
  test("returns the persisted result id", async () => {
    const { factory, client } = makeFactory();
    client.postV1projectsJudgeResults.mockResolvedValueOnce({
      id: "result-1",
    });

    const result = await factory.submitResult({
      judgeId: "judge-1",
      target: { type: "trace", traceId: "trace-1" },
      value: true,
    });

    expect(result).toBe("result-1");
  });

  test("sends the expected payload shape", async () => {
    const { factory, client } = makeFactory();
    client.postV1projectsJudgeResults.mockResolvedValueOnce({
      id: "result-1",
    });

    await factory.submitResult({
      judgeName: "human-thumbs-up",
      target: { type: "session", sessionId: "session-1" },
      value: true,
      reason: "Looked correct.",
    });

    const call = client.postV1projectsJudgeResults.mock.calls[0];
    const payload = call[1] as Record<string, unknown>;
    expect(payload).toEqual({
      target: { type: "session", session_id: "session-1" },
      value: true,
      judge_name: "human-thumbs-up",
      reason: "Looked correct.",
    });
  });

  test("throws when neither judgeId nor judgeName is provided", async () => {
    const { factory } = makeFactory();

    await expect(
      factory.submitResult({
        target: { type: "trace", traceId: "trace-1" },
        value: true,
      }),
    ).rejects.toThrow(/Exactly one/);
  });

  test("throws when both judgeId and judgeName are provided", async () => {
    const { factory } = makeFactory();

    await expect(
      factory.submitResult({
        judgeId: "judge-1",
        judgeName: "human-thumbs-up",
        target: { type: "trace", traceId: "trace-1" },
        value: true,
      }),
    ).rejects.toThrow(/Exactly one/);
  });

  test("returns null when the project is unresolved", async () => {
    const { factory } = makeFactory(null);

    const result = await factory.submitResult({
      judgeId: "judge-1",
      target: { type: "trace", traceId: "trace-1" },
      value: true,
    });

    expect(result).toBeNull();
  });
});

test("session scores can be resubmitted without a trace", async () => {
  const requests: [string, string, unknown][] = [];
  const client = new JudgmentApiClient("https://api.test", "key", "org");
  client.api.use({
    async onRequest({ request }) {
      const path = new URL(request.url).pathname;
      requests.push([request.method, path, await request.json()]);
      return Response.json(
        path.endsWith("/judges")
          ? {
              judge_id: "judge-1",
              judge_version_id: "version-1",
              implementation_id: null,
            }
          : { id: "result-1" },
      );
    },
  });
  const factory = new ExternalJudgeFactory(client, "proj-1", "test");
  const judge = await factory.create({ name: "rating", scoreType: "numeric" });
  const result = await factory.submitResult({
    judgeId: "judge-1",
    target: { type: "session", sessionId: "session-1" },
    value: 4.5,
  });
  const updated = await factory.submitResult({
    judgeId: "judge-1",
    target: { type: "session", sessionId: "session-1" },
    value: 3,
  });
  expect({ judge, result, updated, requests }).toEqual({
    judge: {
      judgeId: "judge-1",
      judgeVersionId: "version-1",
      name: "rating",
      scoreType: "numeric",
      judgeDescription: null,
      outputs: null,
      majorVersion: 0,
      minorVersion: 0,
    },
    result: "result-1",
    updated: "result-1",
    requests: [
      [
        "POST",
        "/v1/projects/proj-1/judges",
        {
          judge: {
            name: "rating",
            executionMode: "external",
            initialVersion: { scoreType: "numeric" },
          },
        },
      ],
      [
        "POST",
        "/v1/projects/proj-1/judge-results",
        {
          judge_id: "judge-1",
          target: { type: "session", session_id: "session-1" },
          value: 4.5,
        },
      ],
      [
        "POST",
        "/v1/projects/proj-1/judge-results",
        {
          judge_id: "judge-1",
          target: { type: "session", session_id: "session-1" },
          value: 3,
        },
      ],
    ],
  });
});

test("created names can be used to submit categorical feedback", async () => {
  const requests: unknown[] = [];
  const client = new JudgmentApiClient("https://api.test", "key", "org");
  client.api.use({
    async onRequest({ request }) {
      requests.push(await request.json());
      return Response.json(
        new URL(request.url).pathname.endsWith("/judges")
          ? { judge_id: "j", judge_version_id: "v", implementation_id: null }
          : { id: "feedback-1" },
      );
    },
  });
  const factory = new ExternalJudgeFactory(client, "project", "test");
  const judge = await factory.create({
    name: " topic ",
    scoreType: "categorical",
    outputs: [
      { name: " good ", description: "Good" },
      { name: " bad ", description: "Bad" },
    ],
  });
  if (!judge?.outputs) throw new Error("Judge not created");
  const result = await factory.submitResult({
    judgeName: judge.name,
    target: { type: "trace", traceId: "trace" },
    value: judge.outputs[0].name,
  });
  expect({
    name: judge.name,
    outputs: judge.outputs,
    result,
    requests,
  }).toEqual({
    name: "topic",
    outputs: [
      { name: "good", description: "Good" },
      { name: "bad", description: "Bad" },
    ],
    result: "feedback-1",
    requests: [
      {
        judge: {
          name: "topic",
          executionMode: "external",
          initialVersion: {
            scoreType: "categorical",
            outputs: [
              { name: "good", description: "Good" },
              { name: "bad", description: "Bad" },
            ],
          },
        },
      },
      {
        judge_name: "topic",
        target: { type: "trace", trace_id: "trace" },
        value: "good",
      },
    ],
  });
});

test("rejects ambiguous targets before sending feedback", async () => {
  const { factory } = makeFactory();
  const target = {
    type: "session" as const,
    sessionId: "session",
    traceId: "trace",
  };
  await expect(
    // @ts-expect-error Exercise untyped callers passing both target IDs.
    factory.submitResult({ judgeId: "judge", target, value: true }),
  ).rejects.toThrow(/target/);
});

test("surfaces a rejected session score from the server", async () => {
  const client = new JudgmentApiClient("https://api.test", "key", "org");
  client.api.use({
    onRequest() {
      return Response.json({ message: "Session not found" }, { status: 404 });
    },
  });
  const factory = new ExternalJudgeFactory(client, "project", "test");
  await expect(
    factory.submitResult({
      judgeName: "rating",
      target: { type: "session", sessionId: "missing" },
      value: 3,
    }),
  ).rejects.toThrow('HTTP 404: {"message":"Session not found"}');
});
