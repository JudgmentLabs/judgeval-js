import { JudgmentApiClient } from "../../internal/api";
import type { EvaluationBuilder } from "./Evaluation";
import { Evaluation } from "./Evaluation";

export class EvaluationFactory {
  private readonly client: JudgmentApiClient;

  constructor(client: JudgmentApiClient) {
    this.client = client;
  }

  create(): EvaluationBuilder {
    return Evaluation.builder().setClient(this.client);
  }
}
