export type ScoreType = "binary" | "numeric" | "categorical";

/**
 * A judge whose scores are computed outside the Judgment platform.
 *
 * External judges don't have an executable implementation on the
 * platform -- you create one to register its name and score shape, then
 * call `.submitResult()` (as many times as you like) to attach scores
 * your own evaluation code produced to a trace or session.
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
