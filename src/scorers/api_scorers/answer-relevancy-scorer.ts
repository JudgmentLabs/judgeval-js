import { ExampleParams } from "../../data";
import { APIScorer, APIScorerType } from "../api-scorer";

const ANSWER_RELEVANCY_REQUIRED_PARAMS = [
  ExampleParams.INPUT,
  ExampleParams.ACTUAL_OUTPUT,
] as const;

export class AnswerRelevancyScorer extends APIScorer<
  APIScorerType.ANSWER_RELEVANCY,
  typeof ANSWER_RELEVANCY_REQUIRED_PARAMS
> {
  private constructor(scorerArgs?: AnswerRelevancyScorerArgs) {
    super(APIScorerType.ANSWER_RELEVANCY, ANSWER_RELEVANCY_REQUIRED_PARAMS);

    if (scorerArgs) {
      if (scorerArgs.threshold !== undefined) {
        this.setThreshold(scorerArgs.threshold);
      }
      if (scorerArgs.model) {
        this.addModel(scorerArgs.model);
      }
    }
  }

  static get(scorerArgs?: AnswerRelevancyScorerArgs): AnswerRelevancyScorer {
    return new AnswerRelevancyScorer(scorerArgs);
  }
}

export interface AnswerRelevancyScorerArgs {
  threshold?: number;
  model?: string;
}
