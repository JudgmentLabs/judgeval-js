import { APIScorerType } from "../../data/APIScorerType";
import { APIScorer } from "../APIScorer";

export interface FaithfulnessScorerConfig {
  threshold?: number;
  name?: string;
  strictMode?: boolean;
  model?: string;
}

export class FaithfulnessScorer extends APIScorer {
  constructor(config: FaithfulnessScorerConfig = {}) {
    super(APIScorerType.FAITHFULNESS);
    this.setRequiredParams(["context", "actual_output"]);
    if (config.threshold !== undefined) {
      this.setThreshold(config.threshold);
    }
    if (config.name) {
      this.setName(config.name);
    }
    if (config.strictMode !== undefined) {
      this.setStrictMode(config.strictMode);
    }
    if (config.model) {
      this.setModel(config.model);
    }
  }
}

export interface AnswerCorrectnessScorerConfig {
  threshold?: number;
  name?: string;
  strictMode?: boolean;
  model?: string;
}

export class AnswerCorrectnessScorer extends APIScorer {
  constructor(config: AnswerCorrectnessScorerConfig = {}) {
    super(APIScorerType.ANSWER_CORRECTNESS);
    this.setRequiredParams(["input", "actual_output", "expected_output"]);
    if (config.threshold !== undefined) {
      this.setThreshold(config.threshold);
    }
    if (config.name) {
      this.setName(config.name);
    }
    if (config.strictMode !== undefined) {
      this.setStrictMode(config.strictMode);
    }
    if (config.model) {
      this.setModel(config.model);
    }
  }
}

export interface AnswerRelevancyScorerConfig {
  threshold?: number;
  name?: string;
  strictMode?: boolean;
  model?: string;
}

export class AnswerRelevancyScorer extends APIScorer {
  constructor(config: AnswerRelevancyScorerConfig = {}) {
    super(APIScorerType.ANSWER_RELEVANCY);
    this.setRequiredParams(["input", "actual_output"]);
    if (config.threshold !== undefined) {
      this.setThreshold(config.threshold);
    }
    if (config.name) {
      this.setName(config.name);
    }
    if (config.strictMode !== undefined) {
      this.setStrictMode(config.strictMode);
    }
    if (config.model) {
      this.setModel(config.model);
    }
  }
}

export interface InstructionAdherenceScorerConfig {
  threshold?: number;
  name?: string;
  strictMode?: boolean;
  model?: string;
}

export class InstructionAdherenceScorer extends APIScorer {
  constructor(config: InstructionAdherenceScorerConfig = {}) {
    super(APIScorerType.INSTRUCTION_ADHERENCE);
    this.setRequiredParams(["input", "actual_output"]);
    if (config.threshold !== undefined) {
      this.setThreshold(config.threshold);
    }
    if (config.name) {
      this.setName(config.name);
    }
    if (config.strictMode !== undefined) {
      this.setStrictMode(config.strictMode);
    }
    if (config.model) {
      this.setModel(config.model);
    }
  }
}

export interface DerailmentScorerConfig {
  threshold?: number;
  name?: string;
  strictMode?: boolean;
  model?: string;
}

export class DerailmentScorer extends APIScorer {
  constructor(config: DerailmentScorerConfig = {}) {
    super(APIScorerType.DERAILMENT);
    this.setRequiredParams(["input", "actual_output"]);
    if (config.threshold !== undefined) {
      this.setThreshold(config.threshold);
    }
    if (config.name) {
      this.setName(config.name);
    }
    if (config.strictMode !== undefined) {
      this.setStrictMode(config.strictMode);
    }
    if (config.model) {
      this.setModel(config.model);
    }
  }
}

export class BuiltInScorersFactory {
  answerCorrectness(
    config: AnswerCorrectnessScorerConfig = {},
  ): AnswerCorrectnessScorer {
    return new AnswerCorrectnessScorer(config);
  }

  answerRelevancy(
    config: AnswerRelevancyScorerConfig = {},
  ): AnswerRelevancyScorer {
    return new AnswerRelevancyScorer(config);
  }

  faithfulness(config: FaithfulnessScorerConfig = {}): FaithfulnessScorer {
    return new FaithfulnessScorer(config);
  }

  instructionAdherence(
    config: InstructionAdherenceScorerConfig = {},
  ): InstructionAdherenceScorer {
    return new InstructionAdherenceScorer(config);
  }

  derailment(config: DerailmentScorerConfig = {}): DerailmentScorer {
    return new DerailmentScorer(config);
  }
}
