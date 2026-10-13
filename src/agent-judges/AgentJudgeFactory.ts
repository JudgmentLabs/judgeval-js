import type { JudgmentApiClient } from "../internal/api/client";
import type {
  CreateJudgeRequest,
  JudgeDetail,
  JudgeVersionSelector,
  UpdateJudgeRequest,
} from "../internal/api/models";
import { Logger } from "../utils/logger";
import type { AgentJudge, ReasoningLevel, ScoreType } from "./AgentJudge";

type PromptJudgeDetail = Extract<JudgeDetail, { judge_type: "prompt" }>;
type NewVersion = NonNullable<UpdateJudgeRequest["update"]["newVersion"]>;

/**
 * Create and update prompt-based Agent judges on the Judgment platform.
 *
 * Access via `client.agentJudges`.
 *
 * @example
 * ```typescript
 * const judge = await client.agentJudges.create({
 *   name: "helpfulness",
 *   prompt: "Rate the assistant's helpfulness from 0 to 1.",
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
   * Create a new Agent judge (prompt-based scorer).
   *
   * @param options.name - Unique judge name within the project.
   * @param options.prompt - Rubric prompt template used by the Agent judge harness.
   * @param options.model - Ignored: the platform picks the model from `reasoningLevel`.
   * @param options.reasoningLevel - `"lite"` (server default), `"normal"`, or `"high"`.
   * @param options.scoreType - One of `"numeric"`, `"binary"`, or `"categorical"`.
   * @param options.description - Description stored on the initial judge version.
   * @param options.judgeDescription - Description shown in the UI.
   * @param options.categories - Choice list for `categorical` judges (at least two).
   * @param options.minScore - Lower bound for `numeric` judges (defaults to `0` server-side).
   * @param options.maxScore - Upper bound for `numeric` judges (defaults to `1` server-side).
   * @returns The newly created `AgentJudge`, or `null` if the project is unresolved.
   */
  async create(options: {
    name: string;
    prompt: string;
    /** @deprecated Ignored; the platform picks the model from `reasoningLevel`. */
    model?: string;
    reasoningLevel?: ReasoningLevel;
    scoreType: ScoreType;
    description?: string;
    judgeDescription?: string;
    categories?: { name: string; description: string }[];
    minScore?: number;
    maxScore?: number;
  }): Promise<AgentJudge | null> {
    const projectId = this._expectProjectId();
    if (!projectId) return null;
    warnIfModel(options.model);

    const payload: CreateJudgeRequest = {
      judge: {
        name: options.name,
        judgeDescription: options.judgeDescription,
        judgeType: "prompt",
        initialVersion:
          options.scoreType === "categorical"
            ? { scoreType: "categorical", outputs: options.categories ?? [] }
            : { scoreType: options.scoreType },
        config: {
          prompt: options.prompt,
          description: options.description,
          reasoningLevel: options.reasoningLevel,
          minScore: options.minScore,
          maxScore: options.maxScore,
        },
      },
    };
    const { judge_id } = await this._client.postV1projectsJudges(
      projectId,
      payload,
    );
    return agentJudgeFromDetail(await this._lookup(projectId, judge_id));
  }

  /**
   * Update an existing Agent judge.
   *
   * Passing any version field (`prompt`, `reasoningLevel`, `scoreType`,
   * `description`, `categories`, `minScore`, `maxScore`, or a source/target
   * version) writes a new production version, copying unspecified fields from
   * the source version. When `targetMajorVersion` / `targetMinorVersion` are
   * omitted, the latest version's minor is bumped by 1 — matching the UI's
   * default "save" behaviour. The score type of a judge cannot change.
   *
   * @param options.judgeId - ID of the judge to update.
   * @param options.prompt - New rubric prompt template.
   * @param options.model - Ignored: the platform picks the model from `reasoningLevel`.
   * @param options.reasoningLevel - New reasoning level.
   * @param options.scoreType - Must match the judge's existing score type.
   * @param options.description - New judge-version description.
   * @param options.judgeDescription - New UI-facing description.
   * @param options.categories - New choices for `categorical` judges; names matching an existing choice keep it.
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
    /** @deprecated Ignored; the platform picks the model from `reasoningLevel`. */
    model?: string;
    reasoningLevel?: ReasoningLevel;
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
    warnIfModel(options.model);

    const {
      judgeId,
      judgeDescription,
      model: _model,
      ...versionFields
    } = options;
    const newVersion = Object.values(versionFields).some(
      (value) => value !== undefined,
    )
      ? await this._newVersion(projectId, options)
      : undefined;

    await this._client.patchV1projectsJudgesByJudgeId(projectId, judgeId, {
      update: { judgeDescription, newVersion },
    });
    return agentJudgeFromDetail(
      await this._lookup(projectId, judgeId, newVersion?.targetVersion),
    );
  }

  private async _newVersion(
    projectId: string,
    options: Parameters<AgentJudgeFactory["update"]>[0],
  ): Promise<NewVersion> {
    const hasSource =
      options.sourceMajorVersion !== undefined ||
      options.sourceMinorVersion !== undefined;
    const source = await this._lookup(
      projectId,
      options.judgeId,
      hasSource
        ? {
            major: options.sourceMajorVersion ?? 0,
            minor: options.sourceMinorVersion ?? 0,
          }
        : "latest",
    );
    const latest = hasSource
      ? await this._lookup(projectId, options.judgeId)
      : source;
    const targetVersion =
      options.targetMajorVersion === undefined &&
      options.targetMinorVersion === undefined
        ? {
            major: latest.judge_major_version,
            minor: latest.judge_minor_version + 1,
          }
        : {
            major: options.targetMajorVersion ?? latest.judge_major_version,
            minor: options.targetMinorVersion ?? 0,
          };

    const { definition } = source;
    const base = {
      targetVersion,
      promoteToProduction: true,
      judgeType: "prompt" as const,
      config: {
        prompt: options.prompt ?? definition.prompt,
        description: options.description ?? definition.description,
        reasoningLevel: options.reasoningLevel ?? definition.reasoning_level,
        minScore: options.minScore ?? definition.min_score,
        maxScore: options.maxScore ?? definition.max_score,
      },
      advancedSettings: {
        online_environment_names: source.online_environment_names,
        online_evaluation_mode: source.online_evaluation_mode,
        online_sampling_rate: source.online_sampling_rate,
        online_span_triggers: source.online_span_triggers,
        online_session_scoring: source.online_session_scoring,
        session_evaluation_count_enabled:
          source.session_evaluation_count_enabled,
        session_evaluation_idle_enabled: source.session_evaluation_idle_enabled,
        session_evaluation_min_candidate_traces:
          source.session_evaluation_min_candidate_traces,
        session_evaluation_max_wait_minutes:
          source.session_evaluation_max_wait_minutes,
      },
    };
    const scoreType = options.scoreType ?? source.score_type;
    if (scoreType !== "categorical") return { ...base, scoreType };

    const existing = new Map(
      source.outputs.map((output) => [output.name, output.behavior_id]),
    );
    const outputs = options.categories
      ? options.categories.map((category) => {
          const behaviorId = existing.get(category.name);
          return behaviorId ? { behaviorId } : category;
        })
      : source.outputs.map((output) => ({ behaviorId: output.behavior_id }));
    return { ...base, scoreType, outputs };
  }

  private async _lookup(
    projectId: string,
    judgeId: string,
    version: JudgeVersionSelector = "latest",
  ): Promise<PromptJudgeDetail> {
    const { judge } = await this._client.postV1projectsJudgesByJudgeIdLookup(
      projectId,
      judgeId,
      { version },
    );
    if (judge.judge_type !== "prompt") {
      throw new Error(
        `Judge ${judgeId} is a ${judge.judge_type} judge; only prompt-based Agent judges are supported.`,
      );
    }
    return judge;
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

function warnIfModel(model: string | undefined) {
  if (model !== undefined) {
    Logger.warn(
      "Agent judge `model` is ignored; the platform picks the model from `reasoningLevel`.",
    );
  }
}

function agentJudgeFromDetail(judge: PromptJudgeDetail): AgentJudge {
  return {
    judgeId: judge.id,
    name: judge.name,
    prompt: judge.definition.prompt,
    model: judge.definition.model,
    reasoningLevel: judge.definition.reasoning_level,
    scoreType: judge.score_type,
    description: judge.definition.description,
    judgeDescription: judge.judge_description,
    categories:
      judge.score_type === "categorical"
        ? judge.outputs.map(({ name, description }) => ({ name, description }))
        : null,
    minScore: judge.definition.min_score,
    maxScore: judge.definition.max_score,
    majorVersion: judge.judge_major_version,
    minorVersion: judge.judge_minor_version,
  };
}
