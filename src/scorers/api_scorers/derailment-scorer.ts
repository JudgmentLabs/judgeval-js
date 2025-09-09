import { APIScorer, APIScorerType, createAPIScorer } from "../api-scorer";

const DERAILMENT_REQUIRED_PARAMS = [] as const;

export type DerailmentScorer = APIScorer<
  APIScorerType.DERAILMENT,
  typeof DERAILMENT_REQUIRED_PARAMS
>;

export type DerailmentScorerArgs = {
  threshold?: number;
  model?: string;
};

export function createDerailmentScorer(
  scorerArgs?: DerailmentScorerArgs
): DerailmentScorer {
  const scorer = createAPIScorer(
    APIScorerType.DERAILMENT,
    DERAILMENT_REQUIRED_PARAMS
  );

  if (scorerArgs) {
    if (scorerArgs.threshold !== undefined) {
      scorer.setThreshold(scorerArgs.threshold);
    }
    if (scorerArgs.model) {
      scorer.addModel(scorerArgs.model);
    }
  }

  return scorer;
}
