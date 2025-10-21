import { ExampleParams } from "../../data";
import { APIScorer, APIScorerType } from "../api-scorer";

const FAITHFULNESS_REQUIRED_PARAMS = [
  ExampleParams.INPUT,
  ExampleParams.ACTUAL_OUTPUT,
  ExampleParams.RETRIEVAL_CONTEXT,
] as const;

export class FaithfulnessScorer extends APIScorer<
  APIScorerType.FAITHFULNESS,
  typeof FAITHFULNESS_REQUIRED_PARAMS
> {
  constructor(scorerArgs?: FaithfulnessScorerArgs) {
    super(APIScorerType.FAITHFULNESS, FAITHFULNESS_REQUIRED_PARAMS);

    if (scorerArgs) {
      if (scorerArgs.threshold !== undefined) {
        this.setThreshold(scorerArgs.threshold);
      }
      if (scorerArgs.model) {
        this.addModel(scorerArgs.model);
      }
    }
  }
}

export type FaithfulnessScorerArgs = {
  threshold?: number;
  model?: string;
};

export function createFaithfulnessScorer(
  scorerArgs?: FaithfulnessScorerArgs,
): FaithfulnessScorer {
  return new FaithfulnessScorer(scorerArgs);
}
