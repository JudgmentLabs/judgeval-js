import type { ScorerConfig } from "../internal/api";

export abstract class BaseScorer {
  abstract getName(): string;
  abstract getScorerConfig(): ScorerConfig;
}
