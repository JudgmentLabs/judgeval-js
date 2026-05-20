import { describe, expect, test, mock } from "bun:test";
import { AgentJudgeFactory } from "./AgentJudgeFactory";
import type { JudgmentApiClient } from "../internal/api/client";

interface FakeClient {
  postV1projectsJudges: ReturnType<typeof mock>;
  patchV1projectsJudgesByJudgeId: ReturnType<typeof mock>;
}

function makeFactory(projectId: string | null = "proj-1") {
  const client: FakeClient = {
    postV1projectsJudges: mock(),
    patchV1projectsJudgesByJudgeId: mock(),
  };
  const factory = new AgentJudgeFactory(
    client as unknown as JudgmentApiClient,
    projectId,
    "test-project",
  );
  return { factory, client };
}

function judgeDetail(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "judge-1",
    name: "helpfulness",
    judge_description: "How helpful is the response?",
    method: "LLM",
    output: "",
    last_updated: "2024-01-01",
    score_type: "numeric",
    behaviors: [],
    model: "gpt-5.2",
    prompt: "Rate helpfulness 0-1.",
    description: null,
    categories: null,
    min_score: 0,
    max_score: 1,
    major_version: 0,
    minor_version: 2,
    versions: [],
    ...overrides,
  };
}

describe("AgentJudgeFactory.create", () => {
  test("returns an AgentJudge on success", async () => {
    const { factory, client } = makeFactory();
    client.postV1projectsJudges.mockResolvedValueOnce({ judge_id: "judge-1" });

    const result = await factory.create({
      name: "helpfulness",
      prompt: "Rate helpfulness 0-1.",
      model: "gpt-5.2",
      scoreType: "numeric",
    });

    expect(result).not.toBeNull();
    expect(result?.judgeId).toBe("judge-1");
    expect(result?.scoreType).toBe("numeric");
  });

  test("only sends supplied optional fields", async () => {
    const { factory, client } = makeFactory();
    client.postV1projectsJudges.mockResolvedValueOnce({ judge_id: "judge-1" });

    await factory.create({
      name: "n",
      prompt: "p",
      model: "m",
      scoreType: "binary",
    });

    const call = client.postV1projectsJudges.mock.calls[0];
    const payload = call[1] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(
      ["model", "name", "prompt", "score_type"].sort(),
    );
  });

  test("forwards optional fields", async () => {
    const { factory, client } = makeFactory();
    client.postV1projectsJudges.mockResolvedValueOnce({ judge_id: "judge-1" });

    await factory.create({
      name: "n",
      prompt: "p",
      model: "m",
      scoreType: "categorical",
      description: "d",
      judgeDescription: "jd",
      categories: [{ name: "Yes", description: "" }],
      minScore: 0,
      maxScore: 1,
    });

    const call = client.postV1projectsJudges.mock.calls[0];
    const payload = call[1] as Record<string, unknown>;
    expect(payload.description).toBe("d");
    expect(payload.judge_description).toBe("jd");
    expect(payload.categories).toEqual([{ name: "Yes", description: "" }]);
    expect(payload.min_score).toBe(0);
    expect(payload.max_score).toBe(1);
  });

  test("returns null when project_id is unresolved", async () => {
    const { factory, client } = makeFactory(null);
    const result = await factory.create({
      name: "n",
      prompt: "p",
      model: "m",
      scoreType: "numeric",
    });
    expect(result).toBeNull();
    expect(client.postV1projectsJudges).not.toHaveBeenCalled();
  });
});

describe("AgentJudgeFactory.update", () => {
  test("returns an AgentJudge derived from the response", async () => {
    const { factory, client } = makeFactory();
    client.patchV1projectsJudgesByJudgeId.mockResolvedValueOnce({
      judge: judgeDetail({ prompt: "Updated.", minor_version: 3 }),
    });

    const result = await factory.update({
      judgeId: "judge-1",
      prompt: "Updated.",
    });

    expect(result?.prompt).toBe("Updated.");
    expect(result?.minorVersion).toBe(3);
  });

  test("only sends supplied fields in the patch payload", async () => {
    const { factory, client } = makeFactory();
    client.patchV1projectsJudgesByJudgeId.mockResolvedValueOnce({
      judge: judgeDetail(),
    });

    await factory.update({ judgeId: "judge-1", prompt: "x" });

    const call = client.patchV1projectsJudgesByJudgeId.mock.calls[0];
    const payload = call[2] as Record<string, unknown>;
    expect(payload).toEqual({ prompt: "x" });
  });

  test("forwards explicit source/target versions", async () => {
    const { factory, client } = makeFactory();
    client.patchV1projectsJudgesByJudgeId.mockResolvedValueOnce({
      judge: judgeDetail(),
    });

    await factory.update({
      judgeId: "judge-1",
      prompt: "x",
      sourceMajorVersion: 0,
      sourceMinorVersion: 1,
      targetMajorVersion: 1,
      targetMinorVersion: 0,
    });

    const call = client.patchV1projectsJudgesByJudgeId.mock.calls[0];
    const payload = call[2] as Record<string, unknown>;
    expect(payload.source_major_version).toBe(0);
    expect(payload.source_minor_version).toBe(1);
    expect(payload.target_major_version).toBe(1);
    expect(payload.target_minor_version).toBe(0);
  });

  test("returns null when project_id is unresolved", async () => {
    const { factory, client } = makeFactory(null);
    const result = await factory.update({ judgeId: "judge-1", prompt: "x" });
    expect(result).toBeNull();
    expect(client.patchV1projectsJudgesByJudgeId).not.toHaveBeenCalled();
  });
});
