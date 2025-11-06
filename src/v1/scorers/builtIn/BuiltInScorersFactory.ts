import { APIScorerType } from "../../data/APIScorerType";
import { APIScorer } from "../APIScorer";

export class FaithfulnessScorer extends APIScorer {
  private constructor(builder: FaithfulnessScorerBuilder) {
    super(APIScorerType.FAITHFULNESS);
    this.setRequiredParams(["context", "actual_output"]);
    if (builder.threshold !== undefined) {
      this.setThreshold(builder.threshold);
    }
    if (builder.name) {
      this.setName(builder.name);
    }
    if (builder.strictMode !== undefined) {
      this.setStrictMode(builder.strictMode);
    }
    if (builder.model) {
      this.setModel(builder.model);
    }
  }

  static builder(): FaithfulnessScorerBuilder {
    return new FaithfulnessScorerBuilder();
  }
}

export class FaithfulnessScorerBuilder {
  threshold?: number;
  name?: string;
  strictMode?: boolean;
  model?: string;

  setThreshold(threshold: number): this {
    this.threshold = threshold;
    return this;
  }

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setStrictMode(strictMode: boolean): this {
    this.strictMode = strictMode;
    return this;
  }

  setModel(model: string): this {
    this.model = model;
    return this;
  }

  build(): FaithfulnessScorer {
    return new FaithfulnessScorer(this);
  }
}

export class AnswerCorrectnessScorer extends APIScorer {
  private constructor(builder: AnswerCorrectnessScorerBuilder) {
    super(APIScorerType.ANSWER_CORRECTNESS);
    this.setRequiredParams(["input", "actual_output", "expected_output"]);
    if (builder.threshold !== undefined) {
      this.setThreshold(builder.threshold);
    }
    if (builder.name) {
      this.setName(builder.name);
    }
    if (builder.strictMode !== undefined) {
      this.setStrictMode(builder.strictMode);
    }
    if (builder.model) {
      this.setModel(builder.model);
    }
  }

  static builder(): AnswerCorrectnessScorerBuilder {
    return new AnswerCorrectnessScorerBuilder();
  }
}

export class AnswerCorrectnessScorerBuilder {
  threshold?: number;
  name?: string;
  strictMode?: boolean;
  model?: string;

  setThreshold(threshold: number): this {
    this.threshold = threshold;
    return this;
  }

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setStrictMode(strictMode: boolean): this {
    this.strictMode = strictMode;
    return this;
  }

  setModel(model: string): this {
    this.model = model;
    return this;
  }

  build(): AnswerCorrectnessScorer {
    return new AnswerCorrectnessScorer(this);
  }
}

export class AnswerRelevancyScorer extends APIScorer {
  private constructor(builder: AnswerRelevancyScorerBuilder) {
    super(APIScorerType.ANSWER_RELEVANCY);
    this.setRequiredParams(["input", "actual_output"]);
    if (builder.threshold !== undefined) {
      this.setThreshold(builder.threshold);
    }
    if (builder.name) {
      this.setName(builder.name);
    }
    if (builder.strictMode !== undefined) {
      this.setStrictMode(builder.strictMode);
    }
    if (builder.model) {
      this.setModel(builder.model);
    }
  }

  static builder(): AnswerRelevancyScorerBuilder {
    return new AnswerRelevancyScorerBuilder();
  }
}

export class AnswerRelevancyScorerBuilder {
  threshold?: number;
  name?: string;
  strictMode?: boolean;
  model?: string;

  setThreshold(threshold: number): this {
    this.threshold = threshold;
    return this;
  }

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setStrictMode(strictMode: boolean): this {
    this.strictMode = strictMode;
    return this;
  }

  setModel(model: string): this {
    this.model = model;
    return this;
  }

  build(): AnswerRelevancyScorer {
    return new AnswerRelevancyScorer(this);
  }
}

export class InstructionAdherenceScorer extends APIScorer {
  private constructor(builder: InstructionAdherenceScorerBuilder) {
    super(APIScorerType.INSTRUCTION_ADHERENCE);
    this.setRequiredParams(["input", "actual_output"]);
    if (builder.threshold !== undefined) {
      this.setThreshold(builder.threshold);
    }
    if (builder.name) {
      this.setName(builder.name);
    }
    if (builder.strictMode !== undefined) {
      this.setStrictMode(builder.strictMode);
    }
    if (builder.model) {
      this.setModel(builder.model);
    }
  }

  static builder(): InstructionAdherenceScorerBuilder {
    return new InstructionAdherenceScorerBuilder();
  }
}

export class InstructionAdherenceScorerBuilder {
  threshold?: number;
  name?: string;
  strictMode?: boolean;
  model?: string;

  setThreshold(threshold: number): this {
    this.threshold = threshold;
    return this;
  }

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setStrictMode(strictMode: boolean): this {
    this.strictMode = strictMode;
    return this;
  }

  setModel(model: string): this {
    this.model = model;
    return this;
  }

  build(): InstructionAdherenceScorer {
    return new InstructionAdherenceScorer(this);
  }
}

export class DerailmentScorer extends APIScorer {
  private constructor(builder: DerailmentScorerBuilder) {
    super(APIScorerType.DERAILMENT);
    this.setRequiredParams(["input", "actual_output"]);
    if (builder.threshold !== undefined) {
      this.setThreshold(builder.threshold);
    }
    if (builder.name) {
      this.setName(builder.name);
    }
    if (builder.strictMode !== undefined) {
      this.setStrictMode(builder.strictMode);
    }
    if (builder.model) {
      this.setModel(builder.model);
    }
  }

  static builder(): DerailmentScorerBuilder {
    return new DerailmentScorerBuilder();
  }
}

export class DerailmentScorerBuilder {
  threshold?: number;
  name?: string;
  strictMode?: boolean;
  model?: string;

  setThreshold(threshold: number): this {
    this.threshold = threshold;
    return this;
  }

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setStrictMode(strictMode: boolean): this {
    this.strictMode = strictMode;
    return this;
  }

  setModel(model: string): this {
    this.model = model;
    return this;
  }

  build(): DerailmentScorer {
    return new DerailmentScorer(this);
  }
}

export class BuiltInScorersFactory {
  answerCorrectness(): AnswerCorrectnessScorerBuilder {
    return AnswerCorrectnessScorer.builder();
  }

  answerRelevancy(): AnswerRelevancyScorerBuilder {
    return AnswerRelevancyScorer.builder();
  }

  faithfulness(): FaithfulnessScorerBuilder {
    return FaithfulnessScorer.builder();
  }

  instructionAdherence(): InstructionAdherenceScorerBuilder {
    return InstructionAdherenceScorer.builder();
  }

  derailment(): DerailmentScorerBuilder {
    return DerailmentScorer.builder();
  }
}
