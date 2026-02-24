import type { JudgmentScorerConfig } from "../internal/api";

export abstract class BaseScorer {
  abstract getName(): string;
  abstract getScorerConfig(): JudgmentScorerConfig;
}
