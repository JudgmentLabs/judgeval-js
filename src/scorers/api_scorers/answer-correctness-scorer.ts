import { ExampleParams } from "../../data";
import { APIScorer, APIScorerType } from "../api-scorer";

const ANSWER_CORRECTNESS_REQUIRED_PARAMS = [
  ExampleParams.INPUT,
  ExampleParams.ACTUAL_OUTPUT,
  ExampleParams.EXPECTED_OUTPUT,
] as const;

export class AnswerCorrectnessScorer extends APIScorer<
  APIScorerType.ANSWER_CORRECTNESS,
  typeof ANSWER_CORRECTNESS_REQUIRED_PARAMS
> {
  private constructor(scorerArgs?: AnswerCorrectnessScorerArgs) {
    super(APIScorerType.ANSWER_CORRECTNESS, ANSWER_CORRECTNESS_REQUIRED_PARAMS);

    if (scorerArgs) {
      if (scorerArgs.threshold !== undefined) {
        this.setThreshold(scorerArgs.threshold);
      }
      if (scorerArgs.model) {
        this.addModel(scorerArgs.model);
      }
    }
  }

  static get(
    scorerArgs?: AnswerCorrectnessScorerArgs,
  ): AnswerCorrectnessScorer {
    return new AnswerCorrectnessScorer(scorerArgs);
  }
}

export interface AnswerCorrectnessScorerArgs {
  threshold?: number;
  model?: string;
}
