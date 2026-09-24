export type ScoreType = "binary" | "numeric" | "categorical";

/**
 * Metadata for a created external judge.
 *
 * Returned by `client.externalJudges.create()`. For creation and result
 * submission, see [ExternalJudgeFactory](/sdk-reference/typescript/judges/external-judge-factory).
 */
export interface ExternalJudge {
  judgeId: string;
  judgeVersionId: string;
  name: string;
  scoreType: ScoreType;
  judgeDescription: string | null;
  outputs: { name: string; description: string }[] | null;
  majorVersion: number;
  minorVersion: number;
}
