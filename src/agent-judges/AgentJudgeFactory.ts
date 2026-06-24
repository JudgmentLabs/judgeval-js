import type { JudgmentApiClient } from "../internal/api/client";
import type { SDKCreateAgentJudgeRequest } from "../internal/api/models/SDKCreateAgentJudgeRequest";
import type { SDKUpdateAgentJudgeRequest } from "../internal/api/models/SDKUpdateAgentJudgeRequest";
import type { SDKUpdateAgentJudgeResponse } from "../internal/api/models/SDKUpdateAgentJudgeResponse";
import { Logger } from "../utils/logger";
import type { AgentJudge, ScoreType } from "./AgentJudge";

/**
 * Create and update prompt-based Agent Judges on the Judgment platform.
 *
 * Access via `client.agentJudges`.
 *
 * @example
 * ```typescript
 * const judge = await client.agentJudges.create({
 *   name: "helpfulness",
 *   prompt: "Rate the assistant's helpfulness from 0 to 1.",
 *   model: "gpt-5.2",
 *   scoreType: "numeric",
 * });
 *
 * await client.agentJudges.update({
 *   judgeId: judge.judgeId,
 *   prompt: "Updated rubric prompt.",
 * });
 * ```
 */
export class AgentJudgeFactory {
  private readonly _client: JudgmentApiClient;
  private readonly _projectId: string | null;
  private readonly _projectName: string;

  constructor(
    client: JudgmentApiClient,
    projectId: string | null,
    projectName: string,
  ) {
    this._client = client;
    this._projectId = projectId;
    this._projectName = projectName;
  }

  /**
   * Create a new Agent Judge (prompt-based scorer).
   *
   * @param options.name - Unique judge name within the project.
   * @param options.prompt - Rubric prompt template used by the agent judge harness.
   * @param options.model - LiteLLM model id (e.g. `"gpt-5.2"`).
   * @param options.scoreType - One of `"numeric"`, `"binary"`, or `"categorical"`.
   * @param options.description - Description stored on the underlying scorer version.
   * @param options.judgeDescription - Description shown in the UI.
   * @param options.categories - Choice list for `categorical` judges.
   * @param options.minScore - Lower bound for `numeric` judges (defaults to `0` server-side).
   * @param options.maxScore - Upper bound for `numeric` judges (defaults to `1` server-side).
   * @returns The newly created `AgentJudge`, or `null` if the project is unresolved.
   */
  async create(options: {
    name: string;
    prompt: string;
    model: string;
    scoreType: ScoreType;
    description?: string;
    judgeDescription?: string;
    categories?: { name: string; description: string }[];
    minScore?: number;
    maxScore?: number;
  }): Promise<AgentJudge | null> {
    const projectId = this._expectProjectId();
    if (!projectId) return null;

    const payload: SDKCreateAgentJudgeRequest = {
      name: options.name,
      prompt: options.prompt,
      model: options.model,
      score_type: options.scoreType,
    };
    if (options.description !== undefined)
      payload.description = options.description;
    if (options.judgeDescription !== undefined)
      payload.judge_description = options.judgeDescription;
    if (options.categories !== undefined)
      payload.categories = options.categories;
    if (options.minScore !== undefined) payload.min_score = options.minScore;
    if (options.maxScore !== undefined) payload.max_score = options.maxScore;

    const response = await this._client.postV1projectsJudges(
      projectId,
      payload,
    );

    return {
      judgeId: response.judge_id,
      name: options.name,
      prompt: options.prompt,
      model: options.model,
      scoreType: options.scoreType,
      description: options.description ?? null,
      judgeDescription: options.judgeDescription ?? null,
      categories: options.categories ?? null,
      minScore: options.minScore ?? null,
      maxScore: options.maxScore ?? null,
      majorVersion: 0,
      minorVersion: 0,
    };
  }

  /**
   * Update an existing Agent Judge.
   *
   * Passing any of `prompt`, `model`, `categories`, `minScore`, or
   * `maxScore` writes a new version of the underlying prompt scorer.
   * When `targetMajorVersion` / `targetMinorVersion` are omitted, the
   * server auto-bumps the latest version's minor by 1 — matching the
   * UI's default "save" behaviour.
   *
   * @param options.judgeId - ID of the judge to update.
   * @param options.prompt - New rubric prompt template.
   * @param options.model - New LiteLLM model id.
   * @param options.scoreType - New score type.
   * @param options.description - New scorer-version description.
   * @param options.judgeDescription - New UI-facing description.
   * @param options.categories - New choices for `categorical` judges.
   * @param options.minScore - New lower bound for `numeric` judges.
   * @param options.maxScore - New upper bound for `numeric` judges.
   * @param options.sourceMajorVersion - Major version to copy unspecified fields from.
   * @param options.sourceMinorVersion - Minor version to copy unspecified fields from.
   * @param options.targetMajorVersion - Major version to write to.
   * @param options.targetMinorVersion - Minor version to write to.
   * @returns The updated `AgentJudge`, or `null` if the project is unresolved.
   */
  async update(options: {
    judgeId: string;
    prompt?: string;
    model?: string;
    scoreType?: ScoreType;
    description?: string;
    judgeDescription?: string;
    categories?: { name: string; description: string }[];
    minScore?: number;
    maxScore?: number;
    sourceMajorVersion?: number;
    sourceMinorVersion?: number;
    targetMajorVersion?: number;
    targetMinorVersion?: number;
  }): Promise<AgentJudge | null> {
    const projectId = this._expectProjectId();
    if (!projectId) return null;

    const payload: SDKUpdateAgentJudgeRequest = {};
    if (options.prompt !== undefined) payload.prompt = options.prompt;
    if (options.model !== undefined) payload.model = options.model;
    if (options.scoreType !== undefined) payload.score_type = options.scoreType;
    if (options.description !== undefined)
      payload.description = options.description;
    if (options.judgeDescription !== undefined)
      payload.judge_description = options.judgeDescription;
    if (options.categories !== undefined)
      payload.categories = options.categories;
    if (options.minScore !== undefined) payload.min_score = options.minScore;
    if (options.maxScore !== undefined) payload.max_score = options.maxScore;
    if (options.sourceMajorVersion !== undefined)
      payload.source_major_version = options.sourceMajorVersion;
    if (options.sourceMinorVersion !== undefined)
      payload.source_minor_version = options.sourceMinorVersion;
    if (options.targetMajorVersion !== undefined)
      payload.target_major_version = options.targetMajorVersion;
    if (options.targetMinorVersion !== undefined)
      payload.target_minor_version = options.targetMinorVersion;

    const response = await this._client.patchV1projectsJudgesByJudgeId(
      projectId,
      options.judgeId,
      payload,
    );

    return agentJudgeFromDetail(response);
  }

  private _expectProjectId(): string | null {
    if (!this._projectId) {
      Logger.error(
        "Project ID is not resolved. Agent judge operations require a valid project.",
      );
      return null;
    }
    return this._projectId;
  }
}

function agentJudgeFromDetail(
  response: SDKUpdateAgentJudgeResponse,
): AgentJudge {
  const judge = response.judge;
  return {
    judgeId: judge.id,
    name: judge.name,
    prompt: judge.prompt ?? "",
    model: judge.model ?? "",
    scoreType: judge.score_type as ScoreType,
    description: judge.description ?? null,
    judgeDescription: judge.judge_description ?? null,
    categories: judge.categories ?? null,
    minScore: judge.min_score ?? null,
    maxScore: judge.max_score ?? null,
    majorVersion: judge.major_version ?? null,
    minorVersion: judge.minor_version ?? null,
  };
}
