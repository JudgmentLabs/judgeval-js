import { Example } from '../data/example.js';
import { ScorerData } from '../data/result.js';
import { APIScorer, UNBOUNDED_SCORERS } from '../constants.js';

/**
 * Interface for all judgment scorers
 */
export interface Scorer {
  type: string;
  scoreType: string; // For backward compatibility
  threshold: number;
  score?: number;
  score_breakdown?: Record<string, any>;
  reason?: string;
  success?: boolean;
  evaluation_model?: string;
  strict_mode: boolean;
  async_mode: boolean;
  verbose_mode: boolean;
  include_reason: boolean;
  error?: string;
  evaluation_cost?: number;
  verbose_logs?: string;
  additional_metadata?: Record<string, any>;
  validateThreshold(): void;
  toJSON(): Record<string, any>;
  successCheck(): boolean;
}

/**
 * Base class for API judgment scorers
 */
export abstract class APIJudgmentScorer implements Scorer {
  readonly type: string;
  get scoreType(): string { return this.type; } // For backward compatibility
  readonly threshold: number;
  score?: number;
  score_breakdown?: Record<string, any>;
  additional_metadata?: Record<string, any>;
  strict_mode: boolean;
  async_mode: boolean;
  verbose_mode: boolean;
  include_reason: boolean;

  constructor(type: string, threshold: number, additional_metadata?: Record<string, any>, strict_mode: boolean = false, async_mode: boolean = true, verbose_mode: boolean = true, include_reason: boolean = true) {
    this.type = type;
    this.threshold = threshold;
    this.additional_metadata = additional_metadata;
    this.strict_mode = strict_mode;
    this.async_mode = async_mode;
    this.verbose_mode = verbose_mode;
    this.include_reason = include_reason;
  }

  /**
   * Check if the score meets the threshold
   */
  successCheck(): boolean {
    if (this.score === undefined) {
      return false;
    }
    return this.score >= this.threshold;
  }

  /**
   * Validate that the threshold is within the allowed range
   */
  validateThreshold(): void {
    // Check if this is an unbounded scorer
    const isUnbounded = Array.from(UNBOUNDED_SCORERS).some(
      scorer => scorer.toLowerCase() === this.type.toLowerCase()
    );

    if (isUnbounded) {
      if (this.threshold < 0) {
        throw new Error(`Threshold for ${this.type} must be greater than or equal to 0, got: ${this.threshold}`);
      }
    } else {
      if (this.threshold < 0 || this.threshold > 1) {
        throw new Error(`Threshold for ${this.type} must be between 0 and 1, got: ${this.threshold}`);
      }
    }
  }

  /**
   * Convert the scorer to a plain object
   */
  toJSON(): Record<string, any> {
    const result: Record<string, any> = {
      score_type: this.type,
      threshold: this.threshold,
      score: this.score,
      score_breakdown: this.score_breakdown,
      additional_metadata: this.additional_metadata,
      strict_mode: this.strict_mode,
      async_mode: this.async_mode,
      verbose_mode: this.verbose_mode,
      include_reason: this.include_reason,
    };

    return result;
  }

  async a_score_example(example: Example): Promise<ScorerData> {
    throw new Error('API scorers are evaluated on the server side');
  }
}

/**
 * Base class for local judgment scorers
 */
export abstract class JudgevalScorer implements Scorer {
  type: string;
  scoreType: string; // For backward compatibility
  threshold: number;
  score?: number;
  score_breakdown?: Record<string, any>;
  reason?: string;
  success?: boolean;
  evaluation_model?: string;
  strict_mode: boolean;
  async_mode: boolean;
  verbose_mode: boolean;
  include_reason: boolean;
  error?: string;
  evaluation_cost?: number;
  verbose_logs?: string;
  additional_metadata?: Record<string, any>;

  constructor(
    type: string, 
    threshold: number, 
    additional_metadata?: Record<string, any>, 
    include_reason: boolean = true,
    async_mode: boolean = true,
    strict_mode: boolean = false,
    verbose_mode: boolean = true
  ) {
    this.type = type;
    this.scoreType = type; // For backward compatibility
    this.threshold = strict_mode ? 1.0 : threshold;
    this.strict_mode = strict_mode;
    this.async_mode = async_mode;
    this.verbose_mode = verbose_mode;
    this.include_reason = include_reason;
    this.additional_metadata = additional_metadata;
    this.validateThreshold();
  }

  /**
   * Check if the score meets the threshold
   */
  successCheck(): boolean {
    if (this.error !== undefined) {
      return false;
    }
    return this.score !== undefined && this.score >= this.threshold;
  }

  /**
   * Internal method to check success
   * This is equivalent to Python's _success_check method
   */
  protected _successCheck(): boolean {
    return this.successCheck();
  }

  /**
   * Validate that the threshold is within the allowed range
   */
  validateThreshold(): void {
    // Check if this is an unbounded scorer
    const isUnbounded = Array.from(UNBOUNDED_SCORERS).some(
      scorer => scorer.toLowerCase() === this.type.toLowerCase()
    );

    if (isUnbounded) {
      if (this.threshold < 0) {
        throw new Error(`Threshold for ${this.type} must be greater than or equal to 0, got: ${this.threshold}`);
      }
    } else {
      if (this.threshold < 0 || this.threshold > 1) {
        throw new Error(`Threshold for ${this.type} must be between 0 and 1, got: ${this.threshold}`);
      }
    }
  }

  /**
   * Convert the scorer to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      score_type: this.type,
      threshold: this.threshold,
      score: this.score,
      score_breakdown: this.score_breakdown,
      reason: this.reason,
      success: this.success,
      evaluation_model: this.evaluation_model,
      strict_mode: this.strict_mode,
      async_mode: this.async_mode,
      verbose_mode: this.verbose_mode,
      include_reason: this.include_reason,
      error: this.error,
      evaluation_cost: this.evaluation_cost,
      verbose_logs: this.verbose_logs,
      additional_metadata: this.additional_metadata,
    };
  }

  /**
   * Score an example
   * This must be implemented by subclasses
   */
  abstract scoreExample(example: Example): Promise<ScorerData>;

  /**
   * Get the name of the scorer
   * This is equivalent to Python's __name__ property
   */
  get name(): string {
    return this.type;
  }
}

/**
 * Wrapper for scorers to allow dynamic loading of implementations
 */
export class ScorerWrapper implements Scorer {
  type: string;
  scoreType: string; // For backward compatibility
  threshold: number;
  score?: number;
  score_breakdown?: Record<string, any>;
  reason?: string;
  success?: boolean;
  evaluation_model?: string;
  strict_mode: boolean;
  async_mode: boolean;
  verbose_mode: boolean;
  include_reason: boolean;
  error?: string;
  evaluation_cost?: number;
  verbose_logs?: string;
  additional_metadata?: Record<string, any>;
  scorer: any;

  constructor(scorer: any) {
    this.scorer = scorer;
    this.type = scorer.type;
    this.scoreType = scorer.scoreType || scorer.score_type; // For backward compatibility
    this.threshold = scorer.threshold;
    this.score = scorer.score;
    this.score_breakdown = scorer.score_breakdown;
    this.reason = scorer.reason;
    this.success = scorer.success;
    this.evaluation_model = scorer.evaluation_model;
    this.strict_mode = scorer.strict_mode;
    this.async_mode = scorer.async_mode;
    this.verbose_mode = scorer.verbose_mode;
    this.include_reason = scorer.include_reason;
    this.error = scorer.error;
    this.evaluation_cost = scorer.evaluation_cost;
    this.verbose_logs = scorer.verbose_logs;
    this.additional_metadata = scorer.additional_metadata;
  }

  /**
   * Check if the score meets the threshold
   */
  successCheck(): boolean {
    if (this.score === undefined) {
      return false;
    }
    return this.score >= this.threshold;
  }

  /**
   * Load the appropriate implementation based on the use_judgment flag
   */
  loadImplementation(useJudgment: boolean = true): APIJudgmentScorer | JudgevalScorer {
    // This would be implemented based on the specific scorer types
    // For now, we'll just return the scorer as is
    if (useJudgment) {
      // Return API implementation
      return this.scorer as APIJudgmentScorer;
    } else {
      // Return local implementation
      return this.scorer as JudgevalScorer;
    }
  }

  /**
   * Validate that the threshold is within the allowed range
   */
  validateThreshold(): void {
    // Check if this is an unbounded scorer
    const isUnbounded = Array.from(UNBOUNDED_SCORERS).some(
      scorer => scorer.toLowerCase() === this.type.toLowerCase()
    );

    if (isUnbounded) {
      if (this.threshold < 0) {
        throw new Error(`Threshold for ${this.type} must be greater than or equal to 0, got: ${this.threshold}`);
      }
    } else {
      if (this.threshold < 0 || this.threshold > 1) {
        throw new Error(`Threshold for ${this.type} must be between 0 and 1, got: ${this.threshold}`);
      }
    }
  }

  /**
   * Convert the scorer to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      score_type: this.type,
      threshold: this.threshold,
      score: this.score,
      score_breakdown: this.score_breakdown,
      reason: this.reason,
      success: this.success,
      evaluation_model: this.evaluation_model,
      strict_mode: this.strict_mode,
      async_mode: this.async_mode,
      verbose_mode: this.verbose_mode,
      include_reason: this.include_reason,
      error: this.error,
      evaluation_cost: this.evaluation_cost,
      verbose_logs: this.verbose_logs,
      additional_metadata: this.additional_metadata,
    };
  }
}
