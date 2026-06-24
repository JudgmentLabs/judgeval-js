import type { JudgmentApiClient } from "../internal/api/client";
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
export declare class AgentJudgeFactory {
    private readonly _client;
    private readonly _projectId;
    private readonly _projectName;
    constructor(client: JudgmentApiClient, projectId: string | null, projectName: string);
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
    create(options: {
        name: string;
        prompt: string;
        model: string;
        scoreType: ScoreType;
        description?: string;
        judgeDescription?: string;
        categories?: {
            name: string;
            description: string;
        }[];
        minScore?: number;
        maxScore?: number;
    }): Promise<AgentJudge | null>;
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
    update(options: {
        judgeId: string;
        prompt?: string;
        model?: string;
        scoreType?: ScoreType;
        description?: string;
        judgeDescription?: string;
        categories?: {
            name: string;
            description: string;
        }[];
        minScore?: number;
        maxScore?: number;
        sourceMajorVersion?: number;
        sourceMinorVersion?: number;
        targetMajorVersion?: number;
        targetMinorVersion?: number;
    }): Promise<AgentJudge | null>;
    private _expectProjectId;
}
//# sourceMappingURL=AgentJudgeFactory.d.ts.map