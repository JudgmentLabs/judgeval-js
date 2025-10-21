import { ExampleParams } from "../../data";
import { APIScorer, APIScorerType } from "../api-scorer";

const INSTRUCTION_ADHERENCE_REQUIRED_PARAMS = [
  ExampleParams.INPUT,
  ExampleParams.ACTUAL_OUTPUT,
] as const;

export class InstructionAdherenceScorer extends APIScorer<
  APIScorerType.INSTRUCTION_ADHERENCE,
  typeof INSTRUCTION_ADHERENCE_REQUIRED_PARAMS
> {
  constructor(scorerArgs?: InstructionAdherenceScorerArgs) {
    super(
      APIScorerType.INSTRUCTION_ADHERENCE,
      INSTRUCTION_ADHERENCE_REQUIRED_PARAMS,
    );

    this.name = "Instruction Adherence";

    if (scorerArgs) {
      if (scorerArgs.threshold !== undefined) {
        this.setThreshold(scorerArgs.threshold);
      }
      if (scorerArgs.model) {
        this.addModel(scorerArgs.model);
      }
    }
  }
}

export type InstructionAdherenceScorerArgs = {
  threshold?: number;
  model?: string;
};

export function createInstructionAdherenceScorer(
  scorerArgs?: InstructionAdherenceScorerArgs,
): InstructionAdherenceScorer {
  return new InstructionAdherenceScorer(scorerArgs);
}
