import { Example } from '../data/example';
import { ScorerData } from '../data/result';
import { APIScorer, UNBOUNDED_SCORERS } from '../constants';

/**
 * Base interface for all scorers
 */
export interface Scorer {
  scoreType: string;
  threshold: number;
  score?: number;
  
  /**
   * Check if the score meets the threshold
   */
  successCheck(): boolean;
  
  /**
   * Convert the scorer to a plain object
   */
  toJSON(): Record<string, any>;
}

/**
 * Base class for API judgment scorers
 */
export abstract class APIJudgmentScorer implements Scorer {
  scoreType: string;
  threshold: number;
  score?: number;
  metadata?: Record<string, any>;

  constructor(scoreType: string, threshold: number, metadata?: Record<string, any>) {
    this.scoreType = scoreType;
    this.threshold = threshold;
    this.metadata = metadata;
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
   * Validate that the threshold is appropriate for the scorer type
   */
  validateThreshold(): void {
    // Check if this is an unbounded scorer
    const isUnbounded = Array.from(UNBOUNDED_SCORERS).some(
      scorer => scorer.toLowerCase() === this.scoreType.toLowerCase()
    );

    if (isUnbounded) {
      if (this.threshold < 0) {
        throw new Error(`Threshold for ${this.scoreType} must be greater than or equal to 0, got: ${this.threshold}`);
      }
    } else {
      if (this.threshold < 0 || this.threshold > 1) {
        throw new Error(`Threshold for ${this.scoreType} must be between 0 and 1, got: ${this.threshold}`);
      }
    }
  }

  /**
   * Convert the scorer to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      score_type: this.scoreType,
      threshold: this.threshold,
      score: this.score,
      metadata: this.metadata,
    };
  }
}

/**
 * Base class for local judgment scorers
 */
export abstract class JudgevalScorer implements Scorer {
  scoreType: string;
  threshold: number;
  score?: number;
  metadata?: Record<string, any>;

  constructor(scoreType: string, threshold: number, metadata?: Record<string, any>) {
    this.scoreType = scoreType;
    this.threshold = threshold;
    this.metadata = metadata;
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
   * Validate that the threshold is appropriate for the scorer type
   */
  validateThreshold(): void {
    // Check if this is an unbounded scorer
    const isUnbounded = Array.from(UNBOUNDED_SCORERS).some(
      scorer => scorer.toLowerCase() === this.scoreType.toLowerCase()
    );

    if (isUnbounded) {
      if (this.threshold < 0) {
        throw new Error(`Threshold for ${this.scoreType} must be greater than or equal to 0, got: ${this.threshold}`);
      }
    } else {
      if (this.threshold < 0 || this.threshold > 1) {
        throw new Error(`Threshold for ${this.scoreType} must be between 0 and 1, got: ${this.threshold}`);
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
      score_type: this.scoreType,
      threshold: this.threshold,
      score: this.score,
      metadata: this.metadata,
    };
  }
}

/**
 * Wrapper for scorers to allow dynamic loading of implementations
 */
export class ScorerWrapper implements Scorer {
  scoreType: string;
  threshold: number;
  score?: number;
  scorer: any;

  constructor(scorer: any) {
    this.scorer = scorer;
    this.scoreType = scorer.scoreType || scorer.score_type;
    this.threshold = scorer.threshold;
    this.score = scorer.score;
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
   * Convert the scorer to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      score_type: this.scoreType,
      threshold: this.threshold,
      score: this.score,
    };
  }
}
