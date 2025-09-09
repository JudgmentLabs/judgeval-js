import { ExampleParams } from "../../data";
import { APIScorer, APIScorerType, createAPIScorer } from "../api-scorer";

const ANSWER_CORRECTNESS_REQUIRED_PARAMS = [
  ExampleParams.INPUT,
  ExampleParams.ACTUAL_OUTPUT,
  ExampleParams.EXPECTED_OUTPUT,
] as const;

export type AnswerCorrectnessScorer = APIScorer<
  APIScorerType.ANSWER_CORRECTNESS,
  typeof ANSWER_CORRECTNESS_REQUIRED_PARAMS
>;

export type AnswerCorrectnessScorerArgs = {
  threshold?: number;
  model?: string;
};

export function createAnswerCorrectnessScorer(
  scorerArgs?: AnswerCorrectnessScorerArgs
): AnswerCorrectnessScorer {
  const scorer = createAPIScorer(
    APIScorerType.ANSWER_CORRECTNESS,
    ANSWER_CORRECTNESS_REQUIRED_PARAMS
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
