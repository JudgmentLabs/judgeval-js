import { Example } from './data/example.js';
import { APIJudgmentScorer, JudgevalScorer, Scorer } from './scorers/base-scorer.js';
import { Rule } from './rules.js';
import { ACCEPTABLE_MODELS } from './constants.js';

/**
 * Stores example and evaluation scorers together for running an eval task
 */
export interface EvaluationRunOptions {
  logResults?: boolean;
  organizationId?: string;
  projectName?: string;
  evalName?: string;
  examples: Example[];
  scorers: Array<APIJudgmentScorer | JudgevalScorer>;
  model: string | string[] | any; // JudgevalJudge would be implemented separately
  aggregator?: string;
  metadata?: Record<string, any>;
  judgmentApiKey?: string;
  override?: boolean;
  rules?: Rule[];
}

export class EvaluationRun {
  logResults: boolean;
  organizationId?: string;
  projectName?: string;
  evalName?: string;
  examples: Example[];
  scorers: Array<APIJudgmentScorer | JudgevalScorer>;
  model: string | string[] | any; // JudgevalJudge would be implemented separately
  aggregator?: string;
  metadata?: Record<string, any>;
  judgmentApiKey?: string;
  override?: boolean;
  rules?: Rule[];

  constructor(options: EvaluationRunOptions) {
    this.logResults = options.logResults || false;
    this.organizationId = options.organizationId;
    this.projectName = options.projectName;
    this.evalName = options.evalName;
    this.examples = options.examples;
    this.scorers = options.scorers;
    this.model = options.model;
    this.aggregator = options.aggregator;
    this.metadata = options.metadata;
    this.judgmentApiKey = options.judgmentApiKey || '';
    this.override = options.override || false;
    this.rules = options.rules;

    // Validate
    this.validate();
  }

  /**
   * Validate the evaluation run configuration
   */
  private validate(): void {
    // Validate log_results
    if (typeof this.logResults !== 'boolean') {
      throw new Error(`logResults must be a boolean. Received ${this.logResults} of type ${typeof this.logResults}`);
    }

    // Validate project_name
    if (this.logResults && !this.projectName) {
      throw new Error('Project name is required when logResults is true. Please include the projectName argument.');
    }

    // Validate eval_name
    if (this.logResults && !this.evalName) {
      throw new Error('Eval name is required when logResults is true. Please include the evalName argument.');
    }

    // Validate examples
    if (!this.examples || this.examples.length === 0) {
      throw new Error('Examples cannot be empty.');
    }
    for (const example of this.examples) {
      if (!(example instanceof Example)) {
        throw new Error(`Invalid type for Example: ${typeof example}`);
      }
    }

    // Validate scorers
    if (!this.scorers || this.scorers.length === 0) {
      throw new Error('Scorers cannot be empty.');
    }
    for (const scorer of this.scorers) {
      if (!(scorer instanceof APIJudgmentScorer) && !(scorer instanceof JudgevalScorer)) {
        throw new Error(`Invalid type for Scorer: ${typeof scorer}`);
      }
    }

    // Validate model
    if (!this.model) {
      throw new Error('Model cannot be empty.');
    }

    // Check if model is a JudgevalJudge (would be implemented separately)
    if (typeof this.model === 'object' && this.model !== null && !Array.isArray(this.model)) {
      // Verify all scorers are JudgevalScorer when using JudgevalJudge
      if (!this.scorers.every(s => s instanceof JudgevalScorer)) {
        throw new Error('When using a JudgevalJudge model, all scorers must be JudgevalScorer type');
      }
    } else if (typeof this.model === 'string') {
      // Check if model is a string
      if (!ACCEPTABLE_MODELS.has(this.model)) {
        throw new Error(`Model name ${this.model} not recognized. Please select a valid model name.`);
      }
    } else if (Array.isArray(this.model)) {
      // Check if model is an array of strings
      if (!this.model.every(m => typeof m === 'string')) {
        throw new Error('When providing a list of models, all elements must be strings');
      }
      for (const m of this.model) {
        if (!ACCEPTABLE_MODELS.has(m)) {
          throw new Error(`Model name ${m} not recognized. Please select a valid model name.`);
        }
      }
    } else {
      throw new Error(`Model must be one of: string, list of strings, or JudgevalJudge instance. Received type ${typeof this.model}.`);
    }

    // Validate aggregator
    if (Array.isArray(this.model) && !this.aggregator) {
      throw new Error('Aggregator cannot be empty when using multiple models.');
    }
    if (this.aggregator && !ACCEPTABLE_MODELS.has(this.aggregator)) {
      throw new Error(`Model name ${this.aggregator} not recognized.`);
    }
  }

  /**
   * Convert the evaluation run to a plain object
   * 
   */
  toJSON(): Record<string, any> {
    const data: Record<string, any> = {
      log_results: this.logResults,
      organization_id: this.organizationId,
      project_name: this.projectName,
      eval_name: this.evalName,
      examples: this.examples.map(example => example.toJSON ? example.toJSON() : example),
      scorers: this.scorers.map(scorer => {
        if ('toJSON' in scorer) {
          return scorer.toJSON();
        } else if ('toDict' in scorer) {
          return (scorer as any).toDict();
        } else {
          return {
            score_type: (scorer as Scorer).scoreType,
            threshold: (scorer as Scorer).threshold
          };
        }
      }),
      model: this.model,
      aggregator: this.aggregator,
      metadata: this.metadata,
      judgment_api_key: this.judgmentApiKey,
      override: this.override
    };

    if (this.rules) {
      // Process rules to ensure proper serialization
      data.rules = this.rules.map(rule => rule.toJSON ? rule.toJSON() : rule);
    }

    return data;
  }
}
