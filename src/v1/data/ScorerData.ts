import type { ScorerData as APIScorerData } from "../../internal/api/models";

export class ScorerData {
  name?: string | null;
  threshold?: number | null;
  success?: boolean | null;
  score?: number | null;
  reason?: string | null;
  strictMode?: boolean | null;
  evaluationModel?: string | null;
  error?: string | null;
  additionalMetadata?: Record<string, unknown>;
  id?: string | null;

  constructor() {
    this.additionalMetadata = {};
  }

  toModel(): APIScorerData {
    const result: APIScorerData = {
      name: this.name ?? "",
      threshold: this.threshold ?? 0,
      success: this.success ?? false,
    };

    if (this.score !== undefined && this.score !== null) {
      result.score = this.score;
    }
    if (this.reason !== undefined && this.reason !== null) {
      result.reason = this.reason;
    }
    if (this.strictMode !== undefined && this.strictMode !== null) {
      result.strict_mode = this.strictMode;
    }
    if (this.evaluationModel !== undefined && this.evaluationModel !== null) {
      result.evaluation_model = this.evaluationModel;
    }
    if (this.error !== undefined && this.error !== null) {
      result.error = this.error;
    }
    if (
      this.additionalMetadata &&
      Object.keys(this.additionalMetadata).length > 0
    ) {
      result.additional_metadata = this.additionalMetadata;
    }
    if (this.id !== undefined && this.id !== null) {
      result.id = this.id;
    }

    return result;
  }

  static builder(): ScorerDataBuilder {
    return new ScorerDataBuilder();
  }
}

export class ScorerDataBuilder {
  private scorerData: ScorerData;

  constructor() {
    this.scorerData = new ScorerData();
  }

  name(name: string): this {
    this.scorerData.name = name;
    return this;
  }

  score(score: number): this {
    this.scorerData.score = score;
    return this;
  }

  success(success: boolean): this {
    this.scorerData.success = success;
    return this;
  }

  reason(reason: string): this {
    this.scorerData.reason = reason;
    return this;
  }

  threshold(threshold: number): this {
    this.scorerData.threshold = threshold;
    return this;
  }

  strictMode(strictMode: boolean): this {
    this.scorerData.strictMode = strictMode;
    return this;
  }

  evaluationModel(evaluationModel: string): this {
    this.scorerData.evaluationModel = evaluationModel;
    return this;
  }

  error(error: string): this {
    this.scorerData.error = error;
    return this;
  }

  additionalMetadata(additionalMetadata: Record<string, unknown>): this {
    this.scorerData.additionalMetadata = additionalMetadata;
    return this;
  }

  metadata(key: string, value: unknown): this {
    if (!this.scorerData.additionalMetadata) {
      this.scorerData.additionalMetadata = {};
    }
    this.scorerData.additionalMetadata[key] = value;
    return this;
  }

  build(): ScorerData {
    return this.scorerData;
  }
}
