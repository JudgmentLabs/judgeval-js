import type {
  Example as APIExample,
  OtelTraceSpan,
  ScoringResult as APIScoringResult,
} from "../../internal/api/models";
import { Example } from "./Example";
import { ScorerData } from "./ScorerData";

export class ScoringResult {
  success?: boolean | null;
  scorersData?: ScorerData[];
  name?: string | null;
  dataObject?: OtelTraceSpan | Example | null;
  traceId?: string | null;
  runDuration?: number | null;
  evaluationCost?: number | null;

  constructor() {
    this.scorersData = [];
  }

  toModel(): APIScoringResult {
    const result: APIScoringResult = {
      success: this.success ?? false,
      scorers_data: (this.scorersData ?? []).map((s) => s.toModel()),
    };

    if (this.name !== undefined && this.name !== null) {
      result.name = this.name;
    }
    if (this.dataObject !== undefined && this.dataObject !== null) {
      if (this.dataObject instanceof Example) {
        result.data_object = this.dataObject.toModel();
      } else {
        result.data_object = this.dataObject as OtelTraceSpan | APIExample;
      }
    }
    if (this.traceId !== undefined && this.traceId !== null) {
      result.trace_id = this.traceId;
    }
    if (this.runDuration !== undefined && this.runDuration !== null) {
      result.run_duration = this.runDuration;
    }
    if (this.evaluationCost !== undefined && this.evaluationCost !== null) {
      result.evaluation_cost = this.evaluationCost;
    }

    return result;
  }

  static builder(): ScoringResultBuilder {
    return new ScoringResultBuilder();
  }
}

export class ScoringResultBuilder {
  private result: ScoringResult;

  constructor() {
    this.result = new ScoringResult();
  }

  success(success: boolean): this {
    this.result.success = success;
    return this;
  }

  scorersData(scorersData: ScorerData[]): this {
    this.result.scorersData = scorersData;
    return this;
  }

  scorerData(scorerData: ScorerData): this {
    if (!this.result.scorersData) {
      this.result.scorersData = [];
    }
    this.result.scorersData.push(scorerData);
    return this;
  }

  dataObject(dataObject: OtelTraceSpan | Example): this {
    this.result.dataObject = dataObject;
    return this;
  }

  build(): ScoringResult {
    return this.result;
  }
}

