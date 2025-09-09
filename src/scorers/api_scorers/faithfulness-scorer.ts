import { ExampleParams } from "../../data";
import { APIScorer, APIScorerType, createAPIScorer } from "../api-scorer";

const FAITHFULNESS_REQUIRED_PARAMS = [
  ExampleParams.INPUT,
  ExampleParams.ACTUAL_OUTPUT,
  ExampleParams.RETRIEVAL_CONTEXT,
] as const;

export type FaithfulnessScorer = APIScorer<
  APIScorerType.FAITHFULNESS,
  typeof FAITHFULNESS_REQUIRED_PARAMS
>;

export type FaithfulnessScorerArgs = {
  threshold?: number;
  model?: string;
};

export function createFaithfulnessScorer(
  scorerArgs?: FaithfulnessScorerArgs
): FaithfulnessScorer {
  const scorer = createAPIScorer(
    APIScorerType.FAITHFULNESS,
    FAITHFULNESS_REQUIRED_PARAMS
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
