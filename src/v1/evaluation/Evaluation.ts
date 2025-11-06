import { JudgmentApiClient } from "../../internal/api";

export class Evaluation {
  private readonly client: JudgmentApiClient;

  private constructor(builder: EvaluationBuilder) {
    if (!builder.client) {
      throw new Error("client is required");
    }
    this.client = builder.client;
  }

  static builder(): EvaluationBuilder {
    return new EvaluationBuilder();
  }
}

export class EvaluationBuilder {
  client?: JudgmentApiClient;

  setClient(client: JudgmentApiClient): this {
    this.client = client;
    return this;
  }

  build(): Evaluation {
    return new Evaluation(this);
  }
}
