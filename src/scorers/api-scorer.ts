import { APIJudgmentScorer } from './base-scorer';
import { APIScorer, UNBOUNDED_SCORERS } from '../constants';
import { Example } from '../data/example';
import { ScorerData } from '../data/result';

/**
 * Implementation of API-based scorers
 */
export class AnswerCorrectnessScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, additional_metadata?: Record<string, any>, verbose: boolean = false) {
    super('answer_correctness', threshold, additional_metadata, verbose);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class AnswerRelevancyScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, additional_metadata?: Record<string, any>, verbose: boolean = false) {
    super('answer_relevancy', threshold, additional_metadata, verbose);
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
    additional_metadata?: Record<string, any>,
    verbose: boolean = false
  ) {
    super('comparison', threshold, additional_metadata, verbose);
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
      additional_metadata: this.additional_metadata,
      verbose: this.verbose
    };
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class ContextualPrecisionScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, additional_metadata?: Record<string, any>, verbose: boolean = false) {
    super('contextual_precision', threshold, additional_metadata, verbose);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class ContextualRecallScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, additional_metadata?: Record<string, any>, verbose: boolean = false) {
    super('contextual_recall', threshold, additional_metadata, verbose);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class ContextualRelevancyScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, additional_metadata?: Record<string, any>, verbose: boolean = false) {
    super('contextual_relevancy', threshold, additional_metadata, verbose);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class ExecutionOrderScorer extends APIJudgmentScorer {
  strictMode: boolean;
  expectedTools?: string[];

  constructor(threshold: number = 1.0, strictMode: boolean = true, expectedTools?: string[], additional_metadata?: Record<string, any>, verbose: boolean = false) {
    super('execution_order', threshold, additional_metadata, verbose);
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
      additional_metadata: this.additional_metadata,
      verbose: this.verbose
    };
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class FaithfulnessScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, additional_metadata?: Record<string, any>, verbose: boolean = false) {
    super('faithfulness', threshold, additional_metadata, verbose);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class GroundednessScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, additional_metadata?: Record<string, any>, verbose: boolean = false) {
    super('groundedness', threshold, additional_metadata, verbose);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class HallucinationScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, additional_metadata?: Record<string, any>, verbose: boolean = false) {
    super('hallucination', threshold, additional_metadata, verbose);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class InstructionAdherenceScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, additional_metadata?: Record<string, any>, verbose: boolean = false) {
    super('instruction_adherence', threshold, additional_metadata, verbose);
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
    additional_metadata?: Record<string, any>,
    verbose: boolean = false
  ) {
    super('json_correctness', threshold, additional_metadata, verbose);
    this.jsonSchema = jsonSchema;
    this.validateThreshold();
  }

  toJSON(): Record<string, any> {
    return {
      score_type: 'json_correctness', 
      threshold: this.threshold,
      json_schema: this.jsonSchema,
      additional_metadata: this.additional_metadata,
      verbose: this.verbose
    };
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class SummarizationScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, additional_metadata?: Record<string, any>, verbose: boolean = false) {
    super('summarization', threshold, additional_metadata, verbose);
    this.validateThreshold();
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

export class Text2SQLScorer extends APIJudgmentScorer {
  constructor(threshold: number = 0.7, additional_metadata?: Record<string, any>, verbose: boolean = false) {
    super('text2sql', threshold, additional_metadata, verbose);
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

  get additional_metadata(): Record<string, any> | undefined {
    return this.scorer.additional_metadata;
  }

  toJSON(): Record<string, any> {
    return this.scorer.toJSON();
  }

  static fromType(type: string, threshold: number, additional_metadata?: Record<string, any>, verbose: boolean = false): APIJudgmentScorer {
    switch (type.toLowerCase()) {
      case 'answer_correctness':
        return new AnswerCorrectnessScorer(threshold, additional_metadata, verbose);
      case 'answer_relevancy':
        return new AnswerRelevancyScorer(threshold, additional_metadata, verbose);
      case 'comparison':
        // For comparison, extract criteria and description from metadata if available
        const criteria = additional_metadata?.criteria as string[] || ['Accuracy', 'Helpfulness', 'Relevance'];
        const description = additional_metadata?.description as string || 'Compare the outputs based on the given criteria';
        const comparisonMetadata = { ...additional_metadata };
        delete comparisonMetadata?.criteria;
        delete comparisonMetadata?.description;
        return new ComparisonScorer(threshold, criteria, description, comparisonMetadata, verbose);
      case 'contextual_precision':
        return new ContextualPrecisionScorer(threshold, additional_metadata, verbose);
      case 'contextual_recall':
        return new ContextualRecallScorer(threshold, additional_metadata, verbose);
      case 'contextual_relevancy':
        return new ContextualRelevancyScorer(threshold, additional_metadata, verbose);
      case 'execution_order':
        // For execution order, extract strict_mode and expected_tools from metadata if available
        const strictMode = additional_metadata?.strict_mode as boolean || true;
        const expectedTools = additional_metadata?.expected_tools as string[];
        const executionOrderMetadata = { ...additional_metadata };
        delete executionOrderMetadata?.strict_mode;
        delete executionOrderMetadata?.expected_tools;
        return new ExecutionOrderScorer(threshold, strictMode, expectedTools, executionOrderMetadata, verbose);
      case 'faithfulness':
        return new FaithfulnessScorer(threshold, additional_metadata, verbose);
      case 'groundedness':
        return new GroundednessScorer(threshold, additional_metadata, verbose);
      case 'hallucination':
        return new HallucinationScorer(threshold, additional_metadata, verbose);
      case 'instruction_adherence':
        return new InstructionAdherenceScorer(threshold, additional_metadata, verbose);
      case 'json_correctness':
        // For JSON correctness, extract json_schema from metadata if available
        const jsonSchema = additional_metadata?.json_schema;
        const jsonMetadata = { ...additional_metadata };
        delete jsonMetadata?.json_schema;
        return new JsonCorrectnessScorer(threshold, jsonSchema, jsonMetadata, verbose);
      case 'summarization':
        return new SummarizationScorer(threshold, additional_metadata, verbose);
      case 'text2sql':
        return new Text2SQLScorer(threshold, additional_metadata, verbose);
      default:
        throw new Error(`Unknown scorer type: ${type}`);
    }
  }
}
