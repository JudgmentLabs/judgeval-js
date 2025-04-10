import { APIJudgmentScorer } from './base-scorer';
import { APIScorer, UNBOUNDED_SCORERS } from '../constants';

/**
 * Implementation of API-based scorers
 */
export class AnswerCorrectnessScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('answer_correctness', threshold, metadata);
    this.validateThreshold();
  }
}

export class AnswerRelevancyScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('answer_relevancy', threshold, metadata);
    this.validateThreshold();
  }
}

export class ComparisonScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0, metadata?: Record<string, any>) {
    super('comparison', threshold, metadata);
    // Comparison is an unbounded scorer, only validate that threshold >= 0
    if (threshold < 0) {
      throw new Error(`Threshold for comparison must be greater than or equal to 0, got: ${threshold}`);
    }
  }
}

export class ContextualPrecisionScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('contextual_precision', threshold, metadata);
    this.validateThreshold();
  }
}

export class ContextualRecallScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('contextual_recall', threshold, metadata);
    this.validateThreshold();
  }
}

export class ContextualRelevancyScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('contextual_relevancy', threshold, metadata);
    this.validateThreshold();
  }
}

export class ExecutionOrderScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('execution_order', threshold, metadata);
    this.validateThreshold();
  }
}

export class FaithfulnessScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('faithfulness', threshold, metadata);
    this.validateThreshold();
  }
}

export class GroundednessScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('groundedness', threshold, metadata);
    this.validateThreshold();
  }
}

export class HallucinationScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('hallucination', threshold, metadata);
    this.validateThreshold();
  }
}

export class InstructionAdherenceScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('instruction_adherence', threshold, metadata);
    this.validateThreshold();
  }
}

export class JsonCorrectnessScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('json_correctness', threshold, metadata);
    this.validateThreshold();
  }
}

export class SummarizationScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('summarization', threshold, metadata);
    this.validateThreshold();
  }
}

export class Text2SQLScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('text2sql', threshold, metadata);
    this.validateThreshold();
  }
}

// Create a ScorerWrapper class to dynamically load the appropriate implementation
export class ScorerWrapper {
  private scorer: APIJudgmentScorer;

  constructor(scorer: APIJudgmentScorer) {
    this.scorer = scorer;
  }

  get scoreType(): string {
    return this.scorer.scoreType;
  }

  get threshold(): number {
    return this.scorer.threshold;
  }

  get metadata(): Record<string, any> | undefined {
    return this.scorer.metadata;
  }

  toJSON(): Record<string, any> {
    return this.scorer.toJSON();
  }

  static fromType(type: string, threshold: number, metadata?: Record<string, any>): APIJudgmentScorer {
    switch (type.toLowerCase()) {
      case 'answer_correctness':
        return new AnswerCorrectnessScorer(threshold, metadata);
      case 'answer_relevancy':
        return new AnswerRelevancyScorer(threshold, metadata);
      case 'comparison':
        return new ComparisonScorer(threshold, metadata);
      case 'contextual_precision':
        return new ContextualPrecisionScorer(threshold, metadata);
      case 'contextual_recall':
        return new ContextualRecallScorer(threshold, metadata);
      case 'contextual_relevancy':
        return new ContextualRelevancyScorer(threshold, metadata);
      case 'execution_order':
        return new ExecutionOrderScorer(threshold, metadata);
      case 'faithfulness':
        return new FaithfulnessScorer(threshold, metadata);
      case 'groundedness':
        return new GroundednessScorer(threshold, metadata);
      case 'hallucination':
        return new HallucinationScorer(threshold, metadata);
      case 'instruction_adherence':
        return new InstructionAdherenceScorer(threshold, metadata);
      case 'json_correctness':
        return new JsonCorrectnessScorer(threshold, metadata);
      case 'summarization':
        return new SummarizationScorer(threshold, metadata);
      case 'text2sql':
        return new Text2SQLScorer(threshold, metadata);
      default:
        throw new Error(`Unknown scorer type: ${type}`);
    }
  }
}
