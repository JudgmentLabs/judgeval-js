import { describe, expect, test, mock } from "bun:test";
import { AgentJudgeFactory } from "./AgentJudgeFactory";
import type { JudgmentApiClient } from "../internal/api/client";

interface FakeClient {
  postV1projectsJudges: ReturnType<typeof mock>;
  patchV1projectsJudgesByJudgeId: ReturnType<typeof mock>;
  postV1projectsJudgesByJudgeIdLookup: ReturnType<typeof mock>;
}

const ADVANCED_SETTINGS = {
  online_environment_names: null,
  online_evaluation_mode: "on_demand",
  online_sampling_rate: 100,
  online_span_triggers: null,
  online_session_scoring: false,
  session_evaluation_count_enabled: null,
  session_evaluation_idle_enabled: null,
  session_evaluation_min_candidate_traces: null,
  session_evaluation_max_wait_minutes: null,
};

const DEFINITION = {
  id: "def-1",
  description: null,
  prompt: "Rate helpfulness 0-1.",
  reasoning_level: "lite",
  min_score: 0,
  max_score: 1,
  model: "gpt-5.2",
  threshold: 0.5,
};

function judgeDetail(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "judge-1",
    name: "helpfulness",
    judge_description: "How helpful is the response?",
    judge_type: "prompt",
    score_type: "numeric",
    outputs: [],
    judge_major_version: 1,
    judge_minor_version: 2,
    ...ADVANCED_SETTINGS,
    definition: DEFINITION,
    ...overrides,
  };
}

const CATEGORICAL = judgeDetail({
  score_type: "categorical",
  outputs: [
    { behavior_id: "b-yes", name: "Yes", description: "y" },
    { behavior_id: "b-no", name: "No", description: "n" },
  ],
});

function makeFactory(
  projectId: string | null = "proj-1",
  lookups: Record<string, unknown>[] = [judgeDetail()],
) {
  const lookup = mock();
  for (const judge of lookups) lookup.mockResolvedValueOnce({ judge });
  lookup.mockResolvedValue({ judge: judgeDetail() });
  const client: FakeClient = {
    postV1projectsJudges: mock().mockResolvedValue({ judge_id: "judge-1" }),
    patchV1projectsJudgesByJudgeId: mock().mockResolvedValue({
      judge_id: "judge-1",
    }),
    postV1projectsJudgesByJudgeIdLookup: lookup,
  };
  const factory = new AgentJudgeFactory(
    client as unknown as JudgmentApiClient,
    projectId,
    "test-project",
  );
  return { factory, client };
}

function patchBody(client: FakeClient) {
  return client.patchV1projectsJudgesByJudgeId.mock.calls[0][2];
}

const PASS_FAIL = {
  scoreType: "categorical",
  outputs: [
    { name: "Pass", description: "The output meets the rubric." },
    { name: "Fail", description: "The output does not meet the rubric." },
  ],
};

describe("AgentJudgeFactory.create", () => {
  test("sends the prompt-judge create body", async () => {
    const { factory, client } = makeFactory();

    await factory.create({
      name: "n",
      prompt: "p",
      scoreType: "binary",
      reasoningLevel: "high",
      description: "d",
      judgeDescription: "jd",
      minScore: 1,
      maxScore: 5,
    });

    expect(client.postV1projectsJudges.mock.calls[0]).toEqual([
      "proj-1",
      {
        judge: {
          name: "n",
          judgeDescription: "jd",
          judgeType: "prompt",
          initialVersion: PASS_FAIL,
          config: {
            prompt: "p",
            description: "d",
            reasoningLevel: "high",
            minScore: 1,
            maxScore: 5,
          },
        },
      },
    ]);
  });

  test("sends categories as categorical outputs", async () => {
    const { factory, client } = makeFactory();
    const categories = [
      { name: "Yes", description: "y" },
      { name: "No", description: "n" },
    ];

    await factory.create({
      name: "n",
      prompt: "p",
      scoreType: "categorical",
      categories,
    });

    expect(
      client.postV1projectsJudges.mock.calls[0][1].judge.initialVersion,
    ).toEqual({ scoreType: "categorical", outputs: categories });
  });

  test("returns the created judge as looked up from the server", async () => {
    const { factory } = makeFactory();

    const result = await factory.create({
      name: "helpfulness",
      prompt: "Rate helpfulness 0-1.",
      model: "ignored",
      scoreType: "binary",
    });

    expect(result).toEqual({
      judgeId: "judge-1",
      name: "helpfulness",
      prompt: "Rate helpfulness 0-1.",
      model: "gpt-5.2",
      reasoningLevel: "lite",
      scoreType: "numeric",
      description: null,
      judgeDescription: "How helpful is the response?",
      categories: null,
      minScore: 0,
      maxScore: 1,
      majorVersion: 1,
      minorVersion: 2,
    });
  });

  test("returns null without calling the API when project_id is unresolved", async () => {
    const { factory, client } = makeFactory(null);

    const result = await factory.create({
      name: "n",
      prompt: "p",
      scoreType: "binary",
    });

    expect(result).toBeNull();
    expect(client.postV1projectsJudges).not.toHaveBeenCalled();
  });

  test("rejects numeric judges before calling the API", async () => {
    const { factory, client } = makeFactory();

    const error = await factory
      .create({ name: "n", prompt: "p", scoreType: "numeric" })
      .catch((e: Error) => e.message);

    expect({
      error,
      calls: client.postV1projectsJudges.mock.calls.length,
    }).toEqual({
      error:
        'New Agent judges must be categorical. Use scoreType "categorical" with categories, or "binary" for Pass / Fail.',
      calls: 0,
    });
  });
});

describe("AgentJudgeFactory.update", () => {
  test("writes a complete production version bumped from latest", async () => {
    const { factory, client } = makeFactory();

    await factory.update({ judgeId: "judge-1", prompt: "Updated." });

    expect(patchBody(client)).toEqual({
      update: {
        judgeDescription: undefined,
        newVersion: {
          targetVersion: { major: 1, minor: 3 },
          promoteToProduction: true,
          judgeType: "prompt",
          scoreType: "numeric",
          config: {
            prompt: "Updated.",
            description: null,
            reasoningLevel: "lite",
            minScore: 0,
            maxScore: 1,
          },
          advancedSettings: ADVANCED_SETTINGS,
        },
      },
    });
  });

  test("updates only the description without writing a version", async () => {
    const { factory, client } = makeFactory();

    await factory.update({ judgeId: "judge-1", judgeDescription: "new" });

    expect(patchBody(client)).toEqual({
      update: { judgeDescription: "new", newVersion: undefined },
    });
  });

  test("copies from the source version and writes the target version", async () => {
    const { factory, client } = makeFactory("proj-1", [
      judgeDetail(),
      judgeDetail({
        definition: { ...DEFINITION, prompt: "v0.1" },
      }),
    ]);

    await factory.update({
      judgeId: "judge-1",
      sourceMajorVersion: 0,
      sourceMinorVersion: 1,
      targetMajorVersion: 2,
      targetMinorVersion: 0,
    });

    expect([
      patchBody(client).update.newVersion.targetVersion,
      patchBody(client).update.newVersion.config.prompt,
    ]).toEqual([{ major: 2, minor: 0 }, "v0.1"]);
  });

  test("reads a minor-only source version from the latest major", async () => {
    const { factory, client } = makeFactory();

    await factory.update({ judgeId: "judge-1", sourceMinorVersion: 1 });

    expect(client.postV1projectsJudgesByJudgeIdLookup.mock.calls[1][2]).toEqual(
      { version: { major: 1, minor: 1 } },
    );
  });

  test("reuses existing behaviors for categories with matching names", async () => {
    const { factory, client } = makeFactory("proj-1", [CATEGORICAL]);

    await factory.update({
      judgeId: "judge-1",
      categories: [
        { name: "Yes", description: "y" },
        { name: "Maybe", description: "m" },
      ],
    });

    expect(patchBody(client).update.newVersion.outputs).toEqual([
      { behaviorId: "b-yes" },
      { name: "Maybe", description: "m" },
    ]);
  });

  test("keeps existing categorical outputs when categories are omitted", async () => {
    const { factory, client } = makeFactory("proj-1", [CATEGORICAL]);

    await factory.update({ judgeId: "judge-1", prompt: "x" });

    expect(patchBody(client).update.newVersion.outputs).toEqual([
      { behaviorId: "b-yes" },
      { behaviorId: "b-no" },
    ]);
  });

  test("returns the written version as looked up from the server", async () => {
    const { factory } = makeFactory("proj-1", [
      judgeDetail(),
      judgeDetail({ judge_minor_version: 3 }),
    ]);

    const result = await factory.update({ judgeId: "judge-1", prompt: "x" });

    expect(result?.minorVersion).toBe(3);
  });

  test("rejects judges that are not prompt-based", async () => {
    const { factory } = makeFactory("proj-1", [
      judgeDetail({ judge_type: "custom" }),
    ]);

    const update = factory.update({ judgeId: "judge-1", prompt: "x" });

    await expect(update).rejects.toThrow("only prompt-based Agent judges");
  });

  test("returns null without calling the API when project_id is unresolved", async () => {
    const { factory, client } = makeFactory(null);

    const result = await factory.update({ judgeId: "judge-1", prompt: "x" });

    expect(result).toBeNull();
    expect(client.patchV1projectsJudgesByJudgeId).not.toHaveBeenCalled();
  });
});
