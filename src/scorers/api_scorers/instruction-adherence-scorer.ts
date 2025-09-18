import { ExampleParams } from "../../data";
import { APIScorer, APIScorerType, createAPIScorer } from "../api-scorer";

const INSTRUCTION_ADHERENCE_REQUIRED_PARAMS = [
  ExampleParams.INPUT,
  ExampleParams.ACTUAL_OUTPUT,
] as const;

export type InstructionAdherenceScorer = APIScorer<
  APIScorerType.INSTRUCTION_ADHERENCE,
  typeof INSTRUCTION_ADHERENCE_REQUIRED_PARAMS
>;

export type InstructionAdherenceScorerArgs = {
  threshold?: number;
  model?: string;
};

export function createInstructionAdherenceScorer(
  scorerArgs?: InstructionAdherenceScorerArgs,
): InstructionAdherenceScorer {
  const scorer = createAPIScorer(
    APIScorerType.INSTRUCTION_ADHERENCE,
    INSTRUCTION_ADHERENCE_REQUIRED_PARAMS,
  );

  scorer.name = "Instruction Adherence";

  if (scorerArgs) {
    if (scorerArgs.threshold !== undefined) {
      scorer.setThreshold(scorerArgs.threshold);
    }
    if (scorerArgs.model) {
      scorer.addModel(scorerArgs.model);
    }
  }

  return scorer;
}
