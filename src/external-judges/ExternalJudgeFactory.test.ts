import { describe, expect, test, mock } from "bun:test";
import { ExternalJudgeFactory } from "./ExternalJudgeFactory";
import type { JudgmentApiClient } from "../internal/api/client";

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
      judgeId: "judge-1",
      judgeVersionId: "version-1",
      implementationId: null,
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
      judgeId: "judge-1",
      judgeVersionId: "version-1",
      implementationId: null,
    });

    await factory.create({ name: "n", scoreType: "binary" });

    const call = client.postV1projectsJudges.mock.calls[0];
    const payload = call[1] as Record<string, unknown>;
    expect(payload).toEqual({
      name: "n",
      judgeType: "external",
      initialVersion: { scoreType: "binary" },
    });
  });

  test("includes categorical outputs in the payload", async () => {
    const { factory, client } = makeFactory();
    client.postV1projectsJudges.mockResolvedValueOnce({
      judgeId: "judge-1",
      judgeVersionId: "version-1",
      implementationId: null,
    });
    const outputs = [
      { name: "good", description: "Good response" },
      { name: "bad", description: "Bad response" },
    ];

    await factory.create({ name: "n", scoreType: "categorical", outputs });

    const call = client.postV1projectsJudges.mock.calls[0];
    const payload = call[1] as Record<string, unknown>;
    expect(payload.initialVersion).toEqual({
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
      traceId: "trace-1",
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
      traceId: "trace-1",
      value: true,
      sessionId: "session-1",
      reason: "Looked correct.",
    });

    const call = client.postV1projectsJudgeResults.mock.calls[0];
    const payload = call[1] as Record<string, unknown>;
    expect(payload).toEqual({
      trace_id: "trace-1",
      value: true,
      judge_name: "human-thumbs-up",
      session_id: "session-1",
      reason: "Looked correct.",
    });
  });

  test("throws when neither judgeId nor judgeName is provided", async () => {
    const { factory } = makeFactory();

    await expect(
      factory.submitResult({ traceId: "trace-1", value: true }),
    ).rejects.toThrow(/Exactly one/);
  });

  test("throws when both judgeId and judgeName are provided", async () => {
    const { factory } = makeFactory();

    await expect(
      factory.submitResult({
        judgeId: "judge-1",
        judgeName: "human-thumbs-up",
        traceId: "trace-1",
        value: true,
      }),
    ).rejects.toThrow(/Exactly one/);
  });

  test("returns null when the project is unresolved", async () => {
    const { factory } = makeFactory(null);

    const result = await factory.submitResult({
      judgeId: "judge-1",
      traceId: "trace-1",
      value: true,
    });

    expect(result).toBeNull();
  });
});
