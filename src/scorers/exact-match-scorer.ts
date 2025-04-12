/**
 * ExactMatchScorer - A custom scorer that checks if the actual output exactly matches the expected output
 */
import { Example } from '../data/example.js';
import { JudgevalScorer } from './base-scorer.js';
import { ScorerData } from '../data/result.js';

export class ExactMatchScorer extends JudgevalScorer {
  constructor(threshold: number = 1.0, additionalMetadata?: Record<string, any>, verbose: boolean = false) {
    super('exact_match', threshold, additionalMetadata, verbose);
  }

  async scoreExample(example: Example): Promise<ScorerData> {
    try {
      // Check if the example has expected output
      if (!example.expectedOutput) {
        return {
          name: this.type,
          threshold: this.threshold,
          success: false,
          score: 0,
          reason: "Expected output is required for exact match scoring",
          strict_mode: null,
          evaluation_model: "exact-match",
          error: "Missing expected output",
          evaluation_cost: null,
          verbose_logs: null,
          additional_metadata: this.additional_metadata || {}
        };
      }

      // Compare the actual output with the expected output
      const actualOutput = example.actualOutput?.trim() || '';
      const expectedOutput = example.expectedOutput.trim();
      
      // Calculate the score (1 for exact match, 0 otherwise)
      const isMatch = actualOutput === expectedOutput;
      this.score = isMatch ? 1 : 0;
      
      // Generate a reason for the score
      const reason = isMatch
        ? "The actual output exactly matches the expected output."
        : `The actual output "${actualOutput}" does not match the expected output "${expectedOutput}".`;
      
      // Return the scorer data
      return {
        name: this.type,
        threshold: this.threshold,
        success: this.successCheck(),
        score: this.score,
        reason: reason,
        strict_mode: null,
        evaluation_model: "exact-match",
        error: null,
        evaluation_cost: null,
        verbose_logs: this.verbose ? `Comparing: "${actualOutput}" with "${expectedOutput}"` : null,
        additional_metadata: this.additional_metadata || {}
      };
    } catch (error) {
      // Handle any errors during scoring
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        name: this.type,
        threshold: this.threshold,
        success: false,
        score: 0,
        reason: `Error during scoring: ${errorMessage}`,
        strict_mode: null,
        evaluation_model: "exact-match",
        error: errorMessage,
        evaluation_cost: null,
        verbose_logs: null,
        additional_metadata: this.additional_metadata || {}
      };
    }
  }
}
