import { BaseScorer as BaseScorerModel } from "../internal/api/models/BaseScorer";

export type BaseScorer = BaseScorerModel & {
  addModel: (model: string) => void;
  successCheck: () => boolean;
  getRequiredParams: () => string[];
};

export function createBaseScorer(): BaseScorer {
  const scorer: BaseScorer = {
    score_type: "",
    class_name: "",
    name: "",
    addModel: (model: string) => {
      scorer.model = model;
    },
    successCheck: () => {
      if (scorer.error != null) {
        return false;
      }
      if (scorer.score == null) {
        return false;
      }
      const threshold = scorer.threshold ?? 0.5;
      const score = scorer.score;
      return threshold != null && score != null && score >= threshold;
    },
    getRequiredParams: () => {
      return [];
    },
  };

  scorer.class_name = "BaseScorer";
  scorer.name = scorer.class_name;
  if (scorer.strict_mode === true) {
    scorer.threshold = 1.0;
  }

  return scorer;
}
