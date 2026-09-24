import type { JudgmentApiClient } from "../internal/api/client";
import type { CreateExternalJudgeInput } from "../internal/api/models/CreateExternalJudgeInput";
import type { SubmitExternalJudgeResult } from "../internal/api/models/SubmitExternalJudgeResult";
import { Logger } from "../utils/logger";
import type { ExternalJudge, ScoreType } from "./ExternalJudge";

/**
 * Create external judges and submit their results on the Judgment platform.
 *
 * Access via `client.externalJudges`.
 *
 * @example
 * ```typescript
 * const judge = await client.externalJudges.create({
 *   name: "human-thumbs-up",
 *   scoreType: "binary",
 * });
 *
 * await client.externalJudges.submitResult({
 *   judgeId: judge.judgeId,
 *   traceId: "<trace_id>",
 *   value: true,
 * });
 * ```
 */
export class ExternalJudgeFactory {
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
   * Create a new external judge and its first version.
   *
   * @param options.name - Unique judge name within the project.
   * @param options.scoreType - One of `"binary"`, `"numeric"`, or `"categorical"`.
   * @param options.judgeDescription - Description shown in the UI.
   * @param options.outputs - Choice list for `categorical` judges (2 or more
   *   entries). Required when `scoreType` is `"categorical"`; must be
   *   omitted otherwise.
   * @returns The newly created `ExternalJudge`, or `null` if the project is unresolved.
   *
   * @example
   * ```typescript
   * const judge = await client.externalJudges.create({
   *   name: "topic-classifier",
   *   scoreType: "categorical",
   *   outputs: [
   *     { name: "billing", description: "Billing questions" },
   *     { name: "support", description: "Support requests" },
   *   ],
   * });
   * ```
   */
  async create(options: {
    name: string;
    scoreType: ScoreType;
    judgeDescription?: string;
    outputs?: { name: string; description: string }[];
  }): Promise<ExternalJudge | null> {
    const projectId = this._expectProjectId();
    if (!projectId) return null;

    let initialVersion: CreateExternalJudgeInput["initialVersion"];
    if (options.scoreType === "categorical") {
      if (!options.outputs || options.outputs.length < 2) {
        throw new Error(
          "outputs must have at least 2 entries for a 'categorical' judge",
        );
      }
      initialVersion = {
        scoreType: "categorical",
        outputs: options.outputs,
      };
    } else {
      if (options.outputs !== undefined) {
        throw new Error(
          `outputs is only valid when scoreType is 'categorical' (got ${options.scoreType})`,
        );
      }
      initialVersion = { scoreType: options.scoreType };
    }

    const payload: CreateExternalJudgeInput = {
      name: options.name,
      judgeType: "external",
      initialVersion,
    };
    if (options.judgeDescription !== undefined)
      payload.judgeDescription = options.judgeDescription;

    const response = await this._client.postV1projectsJudges(
      projectId,
      payload,
    );

    return {
      judgeId: response.judgeId,
      judgeVersionId: response.judgeVersionId,
      name: options.name,
      scoreType: options.scoreType,
      judgeDescription: options.judgeDescription ?? null,
      outputs: options.outputs ?? null,
      majorVersion: 0,
      minorVersion: 0,
    };
  }

  /**
   * Submit an externally computed score to a trace or session.
   *
   * Exactly one of `judgeId` or `judgeName` must be provided; the score
   * is attached to that judge's production version. `value` must match
   * the judge's score type (`boolean` for `binary`, `number` for
   * `numeric`, or one of the judge's configured outputs' names for
   * `categorical`).
   *
   * @param options.traceId - ID of the trace to score.
   * @param options.value - The externally computed score.
   * @param options.judgeId - ID of the judge to submit under.
   * @param options.judgeName - Name of the judge to submit under.
   * @param options.sessionId - If provided, scopes the result to this
   *   session (must match the trace's session) instead of the trace alone.
   * @param options.reason - Optional free-text explanation for the score.
   * @returns The id of the persisted score result, or `null` if the
   *   project is unresolved.
   *
   * @example
   * ```typescript
   * await client.externalJudges.submitResult({
   *   judgeName: "human-thumbs-up",
   *   traceId: "<trace_id>",
   *   value: true,
   *   reason: "Reviewer approved the response.",
   * });
   * ```
   */
  async submitResult(options: {
    traceId: string;
    value: boolean | number | string;
    judgeId?: string;
    judgeName?: string;
    sessionId?: string;
    reason?: string;
  }): Promise<string | null> {
    if ((options.judgeId === undefined) === (options.judgeName === undefined)) {
      throw new Error("Exactly one of judgeId or judgeName must be provided");
    }

    const projectId = this._expectProjectId();
    if (!projectId) return null;

    const payload: Record<string, unknown> = {
      trace_id: options.traceId,
      value: options.value,
    };
    if (options.judgeId !== undefined) payload.judge_id = options.judgeId;
    else payload.judge_name = options.judgeName;
    if (options.sessionId !== undefined) payload.session_id = options.sessionId;
    if (options.reason !== undefined) payload.reason = options.reason;

    const response = await this._client.postV1projectsJudgeResults(
      projectId,
      // SubmitExternalJudgeResult is a top-level discriminated union in the
      // OpenAPI spec (judge_id XOR judge_name); the client generator can't
      // expand top-level unions into a real interface (same limitation as
      // the already-shipped ScoringResult model), so it generates an empty
      // index-signature stub. The payload above is correct per the backend
      // contract regardless.
      payload as SubmitExternalJudgeResult,
    );

    return response.id;
  }

  private _expectProjectId(): string | null {
    if (!this._projectId) {
      Logger.error(
        "Project ID is not resolved. External judge operations require a valid project.",
      );
      return null;
    }
    return this._projectId;
  }
}
