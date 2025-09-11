import { BaseScorer, createBaseScorer } from "./base-scorer";

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

export type APIScorer<
  T extends APIScorerType = APIScorerType,
  P extends readonly string[] = readonly string[],
> = BaseScorer & {
  scoreType: T;
  requiredParams: P;
  setThreshold: (threshold: number) => void;
  getScoreType: () => T;
  setRequiredParams: (params: P) => void;
};

export function createAPIScorer<
  T extends APIScorerType,
  P extends readonly string[],
>(scoreType: T, requiredParams: P): APIScorer<T, P> {
  const scorer = createBaseScorer() as APIScorer<T, P>;

  scorer.scoreType = scoreType;
  scorer.name = scoreType;
  scorer.score_type = scoreType;
  scorer.requiredParams = requiredParams;

  scorer.setThreshold = (threshold: number) => {
    if (threshold < 0 || threshold > 1) {
      throw new Error(`Threshold must be between 0 and 1, got: ${threshold}`);
    }
    scorer.threshold = threshold;
  };

  scorer.getScoreType = () => {
    return scorer.scoreType;
  };

  scorer.setRequiredParams = (params: P) => {
    scorer.requiredParams = params;
  };

  return scorer;
}
