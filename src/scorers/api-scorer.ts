import { APIJudgmentScorer } from './base-scorer';
import { APIScorer, UNBOUNDED_SCORERS } from '../constants';
import { Example } from '../data/example';
import { ScorerData } from '../data/result';

/**
 * Implementation of API-based scorers
 */
export class AnswerCorrectnessScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('answer_correctness', threshold, metadata);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class AnswerRelevancyScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('answer_relevancy', threshold, metadata);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class ComparisonScorer extends APIJudgmentScorer {
  criteria: string[];
  description: string;

  constructor(
    threshold: number = 0.5, 
    criteria: string[] = ['Accuracy', 'Helpfulness', 'Relevance'], 
    description: string = 'Compare the outputs based on the given criteria',
    metadata?: Record<string, any>
  ) {
    super('comparison', threshold, metadata);
    this.criteria = criteria;
    this.description = description;
    // Comparison is an unbounded scorer, only validate that threshold >= 0
    if (threshold < 0) {
      throw new Error(`Threshold for comparison must be greater than or equal to 0, got: ${threshold}`);
    }
  }

  toJSON(): Record<string, any> {
    return {
      score_type: 'comparison', 
      threshold: this.threshold,
      criteria: this.criteria,
      description: this.description,
      metadata: this.metadata
    };
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class ContextualPrecisionScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('contextual_precision', threshold, metadata);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class ContextualRecallScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('contextual_recall', threshold, metadata);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class ContextualRelevancyScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('contextual_relevancy', threshold, metadata);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class ExecutionOrderScorer extends APIJudgmentScorer {
  strictMode: boolean;
  expectedTools?: string[];

  constructor(threshold: number = 1.0, strictMode: boolean = true, expectedTools?: string[], metadata?: Record<string, any>) {
    super('execution_order', threshold, metadata);
    this.strictMode = strictMode;
    this.expectedTools = expectedTools;
    this.validateThreshold();
  }

  toJSON(): Record<string, any> {
    return {
      score_type: 'execution_order',
      threshold: this.threshold,
      strict_mode: this.strictMode,
      expected_tools: this.expectedTools,
      metadata: this.metadata
    };
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class FaithfulnessScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('faithfulness', threshold, metadata);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class GroundednessScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('groundedness', threshold, metadata);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class HallucinationScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('hallucination', threshold, metadata);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class InstructionAdherenceScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('instruction_adherence', threshold, metadata);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class JsonCorrectnessScorer extends APIJudgmentScorer {
  jsonSchema?: Record<string, any>;

  constructor(
    threshold: number = 0.7, 
    jsonSchema?: Record<string, any>,
    metadata?: Record<string, any>
  ) {
    super('json_correctness', threshold, metadata);
    this.jsonSchema = jsonSchema;
    this.validateThreshold();
  }

  toJSON(): Record<string, any> {
    return {
      score_type: 'json_correctness', 
      threshold: this.threshold,
      json_schema: this.jsonSchema,
      metadata: this.metadata
    };
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class SummarizationScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('summarization', threshold, metadata);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class Text2SQLScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, metadata?: Record<string, any>) {
    super('text2sql', threshold, metadata);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
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
        // For comparison, extract criteria and description from metadata if available
        const criteria = metadata?.criteria as string[] || ['Accuracy', 'Helpfulness', 'Relevance'];
        const description = metadata?.description as string || 'Compare the outputs based on the given criteria';
        const comparisonMetadata = { ...metadata };
        delete comparisonMetadata?.criteria;
        delete comparisonMetadata?.description;
        return new ComparisonScorer(threshold, criteria, description, comparisonMetadata);
      case 'contextual_precision':
        return new ContextualPrecisionScorer(threshold, metadata);
      case 'contextual_recall':
        return new ContextualRecallScorer(threshold, metadata);
      case 'contextual_relevancy':
        return new ContextualRelevancyScorer(threshold, metadata);
      case 'execution_order':
        // For execution order, extract strict_mode and expected_tools from metadata if available
        const strictMode = metadata?.strict_mode as boolean || true;
        const expectedTools = metadata?.expected_tools as string[];
        const executionOrderMetadata = { ...metadata };
        delete executionOrderMetadata?.strict_mode;
        delete executionOrderMetadata?.expected_tools;
        return new ExecutionOrderScorer(threshold, strictMode, expectedTools, executionOrderMetadata);
      case 'faithfulness':
        return new FaithfulnessScorer(threshold, metadata);
      case 'groundedness':
        return new GroundednessScorer(threshold, metadata);
      case 'hallucination':
        return new HallucinationScorer(threshold, metadata);
      case 'instruction_adherence':
        return new InstructionAdherenceScorer(threshold, metadata);
      case 'json_correctness':
        // For JSON correctness, extract json_schema from metadata if available
        const jsonSchema = metadata?.json_schema;
        const jsonMetadata = { ...metadata };
        delete jsonMetadata?.json_schema;
        return new JsonCorrectnessScorer(threshold, jsonSchema, jsonMetadata);
      case 'summarization':
        return new SummarizationScorer(threshold, metadata);
      case 'text2sql':
        return new Text2SQLScorer(threshold, metadata);
      default:
        throw new Error(`Unknown scorer type: ${type}`);
    }
  }
}
