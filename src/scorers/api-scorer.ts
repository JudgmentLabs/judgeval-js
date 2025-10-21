import { BaseScorer } from "./base-scorer";

export enum APIScorerType {
  PROMPT_SCORER = "Prompt Scorer",
  TRACE_PROMPT_SCORER = "Trace Prompt Scorer",
  FAITHFULNESS = "Faithfulness",
  ANSWER_RELEVANCY = "Answer Relevancy",
  ANSWER_CORRECTNESS = "Answer Correctness",
  INSTRUCTION_ADHERENCE = "Instruction Adherence",
  EXECUTION_ORDER = "Execution Order",
  TOOL_ORDER = "Tool Order",
  CLASSIFIER = "Classifier",
  TOOL_DEPENDENCY = "Tool Dependency",
  CUSTOM = "Custom",
}

export class APIScorer<
  T extends APIScorerType = APIScorerType,
  P extends readonly string[] = readonly string[],
> extends BaseScorer {
  scoreType: T;
  requiredParams: P;

  constructor(scoreType: T, requiredParams: P) {
    super();
    this.scoreType = scoreType;
    this.name = scoreType;
    this.score_type = scoreType;
    this.requiredParams = requiredParams;
  }

  setThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error(`Threshold must be between 0 and 1, got: ${threshold}`);
    }
    this.threshold = threshold;
  }

  getScoreType(): T {
    return this.scoreType;
  }

  setRequiredParams(params: P): void {
    this.requiredParams = params;
  }

  getRequiredParams(): string[] {
    if (Array.isArray(this.requiredParams)) {
      return [...this.requiredParams];
    }
    return [];
  }
}

export function createAPIScorer<
  T extends APIScorerType,
  P extends readonly string[],
>(scoreType: T, requiredParams: P): APIScorer<T, P> {
  return new APIScorer(scoreType, requiredParams);
}
