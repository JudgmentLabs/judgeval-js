/** The result from a single scorer for one example. */
export interface ScorerData {
  name: string;
  threshold: number;
  success: boolean;
  score: number | null;
  minimumScoreRange: number;
  maximumScoreRange: number;
  reason: string | null;
  evaluationModel: string | null;
  error: string | null;
  additionalMetadata: Record<string, unknown>;
  id: string | null;
}
