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
  additional_metadata?: Record<string, any>;
  verbose: boolean;
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
  additional_metadata?: Record<string, any>;
  verbose: boolean;

  constructor(type: string, threshold: number, additional_metadata?: Record<string, any>, verbose: boolean = false) {
    this.type = type;
    this.threshold = threshold;
    this.additional_metadata = additional_metadata;
    this.verbose = verbose;
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
      additional_metadata: this.additional_metadata,
      verbose: this.verbose,
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
  additional_metadata?: Record<string, any>;
  verbose: boolean;

  constructor(type: string, threshold: number, additional_metadata?: Record<string, any>, verbose: boolean = false) {
    this.type = type;
    this.scoreType = type; // For backward compatibility
    this.threshold = threshold;
    this.additional_metadata = additional_metadata;
    this.verbose = verbose;
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
   * Score an example
   * @param example The example to score
   * @returns A ScorerData object with the score
   */
  abstract scoreExample(example: Example): Promise<ScorerData>;

  /**
   * Convert the scorer to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      score_type: this.type,
      threshold: this.threshold,
      score: this.score,
      additional_metadata: this.additional_metadata,
      verbose: this.verbose,
    };
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
  additional_metadata?: Record<string, any>;
  verbose: boolean;
  scorer: any;

  constructor(scorer: any) {
    this.scorer = scorer;
    this.type = scorer.type;
    this.scoreType = scorer.scoreType || scorer.score_type; // For backward compatibility
    this.threshold = scorer.threshold;
    this.score = scorer.score;
    this.additional_metadata = scorer.additional_metadata;
    this.verbose = scorer.verbose;
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
      additional_metadata: this.additional_metadata,
      verbose: this.verbose,
    };
  }
}
