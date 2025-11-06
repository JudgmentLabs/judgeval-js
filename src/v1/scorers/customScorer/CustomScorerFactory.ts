import { CustomScorer, type CustomScorerConfig } from "./CustomScorer";

export class CustomScorerFactory {
  get(name: string, className?: string): CustomScorer {
    return new CustomScorer({
      name,
      className: className || name,
      serverHosted: true,
    });
  }

  create(config: CustomScorerConfig): CustomScorer {
    if (!config.name) {
      throw new Error("Name is required");
    }
    return new CustomScorer(config);
  }
}
