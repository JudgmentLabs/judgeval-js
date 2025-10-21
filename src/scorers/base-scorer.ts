import { ScorerConfig } from "../internal/api/models";
import { BaseScorer as IBaseScorer } from "../internal/api/models/BaseScorer";

export class BaseScorer implements IBaseScorer {
  score_type: string = "";
  threshold?: number;
  name?: string | null;
  class_name?: string | null;
  score?: number | null;
  score_breakdown?: Record<string, any> | null;
  reason?: string | null;
  using_native_model?: boolean | null;
  success?: boolean | null;
  model?: string | null;
  model_client?: any | null;
  strict_mode?: boolean;
  error?: string | null;
  additional_metadata?: Record<string, any> | null;
  user?: string | null;
  server_hosted?: boolean;

  constructor() {
    this.class_name = "BaseScorer";
    this.name = this.class_name;
    if (this.strict_mode === true) {
      this.threshold = 1.0;
    }
  }

  addModel(model: string): void {
    this.model = model;
  }

  successCheck(): boolean {
    if (this.error != null) {
      return false;
    }
    if (this.score == null) {
      return false;
    }
    const threshold = this.threshold ?? 0.5;
    const score = this.score;
    return threshold != null && score != null && score >= threshold;
  }

  getRequiredParams(): string[] {
    return [];
  }

  getScorerConfig(): ScorerConfig {
    return {
      score_type: this.score_type,
      name: this.name,
      threshold: this.threshold ?? 0.5,
      strict_mode: this.strict_mode ?? false,
      required_params: [],
      kwargs: {},
    };
  }
}

export function createBaseScorer(): BaseScorer {
  return new BaseScorer();
}
