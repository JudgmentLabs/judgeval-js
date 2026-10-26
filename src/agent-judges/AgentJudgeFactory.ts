import type { JudgmentApiClient } from "../internal/api/client";
import type {
  CreateJudgeRequest,
  JudgeDetail,
  JudgeVersionSelector,
  UpdateJudgeRequest,
} from "../internal/api/models";
import { Logger } from "../utils/logger";
import type { AgentJudge, ReasoningLevel, ScoreType } from "./AgentJudge";

// The platform creates only categorical judges (judgment-mono#5377), so a
// binary judge is created as two categorical outputs.
const BINARY_OUTPUTS = [
  { name: "Pass", description: "The output meets the rubric." },
  { name: "Fail", description: "The output does not meet the rubric." },
];

type PromptJudgeDetail = Extract<JudgeDetail, { judge_type: "prompt" }>;
type NewVersion = NonNullable<UpdateJudgeRequest["update"]["newVersion"]>;
type Category = { name: string; description: string };

/** Options for {@link AgentJudgeFactory.update}. */
export interface UpdateOptions {
  judgeId: string;
  prompt?: string;
  /** @deprecated Ignored; the platform picks the model from `reasoningLevel`. */
  model?: string;
  reasoningLevel?: ReasoningLevel;
  scoreType?: ScoreType;
  description?: string;
  judgeDescription?: string;
  categories?: Category[];
  minScore?: number;
  maxScore?: number;
  sourceMajorVersion?: number;
  sourceMinorVersion?: number;
  targetMajorVersion?: number;
  targetMinorVersion?: number;
}

/**
 * Create and update prompt-based Agent judges on the Judgment platform.
 *
 * Access via `client.agentJudges`.
 *
 * @example
 * ```typescript
 * const judge = await client.agentJudges.create({
 *   name: "helpfulness",
 *   prompt: "Did the assistant answer the user's question?",
 *   scoreType: "binary",
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
   * @param options.scoreType - `"categorical"`, or `"binary"` for a categorical judge with
   *   `Pass` / `Fail` outputs. New judges cannot be `"numeric"`; existing numeric judges
   *   can still be updated.
   * @param options.description - Description stored on the initial judge version.
   * @param options.judgeDescription - Description shown in the UI.
   * @param options.categories - Choice list for `categorical` judges (at least two).
   * @param options.minScore - Lower score bound stored on the version.
   * @param options.maxScore - Upper score bound stored on the version.
   * @returns The newly created `AgentJudge`, or `null` if the project is unresolved.
   * @throws If `scoreType` is `"numeric"`.
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
    categories?: Category[];
    minScore?: number;
    maxScore?: number;
  }): Promise<AgentJudge | null> {
    if (options.scoreType === "numeric") {
      throw new Error(
        'New Agent judges must be categorical. Use scoreType "categorical" with categories, or "binary" for Pass / Fail.',
      );
    }
    const projectId = this._expectProjectId();
    if (!projectId) return null;
    warnModelIgnored(options.model);

    const payload: CreateJudgeRequest = {
      judge: {
        name: options.name,
        judgeDescription: options.judgeDescription,
        judgeType: "prompt",
        initialVersion: {
          scoreType: "categorical",
          outputs:
            options.scoreType === "binary"
              ? BINARY_OUTPUTS
              : (options.categories ?? []),
        },
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
    return toAgentJudge(await this._lookupJudge(projectId, judge_id));
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
   * @param options.categories - New choices for `categorical` judges; names matching an existing choice keep it, and must keep its description.
   * @param options.minScore - New lower bound for `numeric` judges.
   * @param options.maxScore - New upper bound for `numeric` judges.
   * @param options.sourceMajorVersion - Major version to copy unspecified fields from. Defaults to the latest major.
   * @param options.sourceMinorVersion - Minor version to copy unspecified fields from. Defaults to the latest version; required when `sourceMajorVersion` is an older major.
   * @param options.targetMajorVersion - Major version to write to. Defaults to the latest major.
   * @param options.targetMinorVersion - Minor version to write to. Defaults to latest minor + 1 in the latest major, else 0.
   * @returns The updated `AgentJudge`, or `null` if the project is unresolved.
   */
  async update(options: UpdateOptions): Promise<AgentJudge | null> {
    const projectId = this._expectProjectId();
    if (!projectId) return null;
    warnModelIgnored(options.model);

    const {
      judgeId,
      judgeDescription,
      model: _model,
      ...versionFields
    } = options;
    const newVersion = Object.values(versionFields).some(
      (value) => value !== undefined,
    )
      ? await this._buildNewVersion(projectId, options)
      : undefined;

    await this._client.patchV1projectsJudgesByJudgeId(projectId, judgeId, {
      update: { judgeDescription, newVersion },
    });
    return toAgentJudge(
      await this._lookupJudge(projectId, judgeId, newVersion?.targetVersion),
    );
  }

  private async _buildNewVersion(
    projectId: string,
    options: UpdateOptions,
  ): Promise<NewVersion> {
    const latest = await this._lookupJudge(projectId, options.judgeId);
    const source = await this._lookupSourceVersion(projectId, options, latest);
    return getPromptVersion(source, getTargetVersion(options, latest), options);
  }

  private async _lookupSourceVersion(
    projectId: string,
    options: UpdateOptions,
    latest: PromptJudgeDetail,
  ): Promise<PromptJudgeDetail> {
    const major = options.sourceMajorVersion ?? latest.judge_major_version;
    // The lookup route takes an exact version, so an older major's latest
    // minor can't be resolved.
    if (
      options.sourceMinorVersion === undefined &&
      major !== latest.judge_major_version
    ) {
      throw new Error(
        "sourceMinorVersion is required when sourceMajorVersion is not the latest major",
      );
    }
    if (options.sourceMinorVersion === undefined) return latest;
    return await this._lookupJudge(projectId, options.judgeId, {
      major,
      minor: options.sourceMinorVersion,
    });
  }

  private async _lookupJudge(
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

function warnModelIgnored(model: string | undefined) {
  if (model !== undefined) {
    Logger.warn(
      "Agent judge `model` is ignored; the platform picks the model from `reasoningLevel`.",
    );
  }
}

function getTargetVersion(
  options: UpdateOptions,
  latest: PromptJudgeDetail,
): NewVersion["targetVersion"] {
  const major = options.targetMajorVersion ?? latest.judge_major_version;
  return {
    major,
    minor:
      options.targetMinorVersion ??
      (major === latest.judge_major_version
        ? latest.judge_minor_version + 1
        : 0),
  };
}

/** A complete production version copied from `source`, with `options` applied. */
function getPromptVersion(
  source: PromptJudgeDetail,
  targetVersion: NewVersion["targetVersion"],
  options: UpdateOptions,
): NewVersion {
  const { definition } = source;
  const version = {
    targetVersion,
    promoteToProduction: true,
    judgeType: "prompt" as const,
    actionConfig: source.action_config,
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
      session_evaluation_count_enabled: source.session_evaluation_count_enabled,
      session_evaluation_idle_enabled: source.session_evaluation_idle_enabled,
      session_evaluation_min_candidate_traces:
        source.session_evaluation_min_candidate_traces,
      session_evaluation_max_wait_minutes:
        source.session_evaluation_max_wait_minutes,
    },
  };
  // create() writes `binary` as a Pass/Fail categorical judge.
  const scoreType =
    options.scoreType === "binary" && source.score_type === "categorical"
      ? "categorical"
      : (options.scoreType ?? source.score_type);
  return scoreType === "categorical"
    ? {
        ...version,
        scoreType,
        outputs: getCategoricalOutputs(source, options.categories),
      }
    : { ...version, scoreType };
}

/** Reuses existing labels by name; new names become new labels. */
function getCategoricalOutputs(
  source: PromptJudgeDetail,
  categories: Category[] | undefined,
) {
  if (!categories) {
    return source.outputs.map((output) => ({ behaviorId: output.behavior_id }));
  }
  const existing = new Map(
    source.outputs.map((output) => [output.name, output]),
  );
  return categories.map((category) => {
    const output = existing.get(category.name);
    if (!output) return category;
    if (output.description !== category.description) {
      throw new Error(
        `Category "${category.name}" already exists with a different description; a new version cannot change it.`,
      );
    }
    return { behaviorId: output.behavior_id };
  });
}

function toAgentJudge(judge: PromptJudgeDetail): AgentJudge {
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
