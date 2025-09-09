import { ExampleParams } from "../../data";
import { APIScorer, APIScorerType, createAPIScorer } from "../api-scorer";

const ANSWER_RELEVANCY_REQUIRED_PARAMS = [
  ExampleParams.INPUT,
  ExampleParams.ACTUAL_OUTPUT,
] as const;

export type AnswerRelevancyScorer = APIScorer<
  APIScorerType.ANSWER_RELEVANCY,
  typeof ANSWER_RELEVANCY_REQUIRED_PARAMS
>;

export type AnswerRelevancyScorerArgs = {
  threshold?: number;
  model?: string;
};

export function createAnswerRelevancyScorer(
  scorerArgs?: AnswerRelevancyScorerArgs
): AnswerRelevancyScorer {
  const scorer = createAPIScorer(
    APIScorerType.ANSWER_RELEVANCY,
    ANSWER_RELEVANCY_REQUIRED_PARAMS
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
