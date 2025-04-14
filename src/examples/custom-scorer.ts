/**
 * Custom Scorer Example
 * 
 * This example demonstrates how to create and use a custom scorer in the TypeScript SDK.
 */

import * as dotenv from 'dotenv';
import { Example, ExampleBuilder } from '../data/example.js';
import { JudgmentClient } from '../judgment-client.js';
import { JudgevalScorer } from '../scorers/base-scorer.js';
import { ScorerData } from '../data/result.js';
import * as logger from '../common/logger.js';

// Load environment variables
dotenv.config();

/**
 * SampleScorer - A custom scorer that checks if the actual output contains the expected output
 */
export class SampleScorer extends JudgevalScorer {
  /**
   * Constructor for SampleScorer
   */
  constructor(
    threshold: number = 0.5,
    score_type: string = "Sample Scorer",
    include_reason: boolean = true,
    async_mode: boolean = true,
    strict_mode: boolean = false,
    verbose_mode: boolean = true
  ) {
    super(score_type, threshold, undefined, include_reason, async_mode, strict_mode, verbose_mode);
    this.threshold = strict_mode ? 1.0 : threshold;
  }

  /**
   * Score an example
   */
  async scoreExample(example: Example): Promise<ScorerData> {
    try {
      // Implement your scoring logic here
      // For this example, we'll check if the actual output contains the expected output
      const actualOutput = example.actualOutput?.toLowerCase() || '';
      const expectedOutput = example.expectedOutput?.toLowerCase() || '';
      
      // Calculate score (simple contains check - 1.0 if contains, 0.0 if not)
      this.score = actualOutput.includes(expectedOutput) ? 1.0 : 0.0;
      
      // Set reason if include_reason is true
      if (this.include_reason) {
        this.reason = this.score === 1.0 
          ? "The actual output contains the expected output."
          : "The actual output does not contain the expected output.";
      }
      
      // Generate verbose logs if verbose_mode is true
      if (this.verbose_mode) {
        this.verbose_logs = `Comparing: "${actualOutput}" with "${expectedOutput}"`;
      }
      
      // Set success based on threshold
      this.success = this._successCheck();
      
      return {
        name: this.type,
        threshold: this.threshold,
        success: this.success,
        score: this.score,
        reason: this.reason || null,
        strict_mode: this.strict_mode,
        evaluation_model: "sample-scorer",
        error: null,
        evaluation_cost: null,
        verbose_logs: this.verbose_logs || null,
        additional_metadata: this.additional_metadata || {}
      };
    } catch (error) {
      // Handle errors
      this.error = error instanceof Error ? error.message : String(error);
      this.success = false;
      
      return {
        name: this.type,
        threshold: this.threshold,
        success: false,
        score: 0,
        reason: `Error during scoring: ${this.error}`,
        strict_mode: this.strict_mode,
        evaluation_model: "sample-scorer",
        error: this.error,
        evaluation_cost: null,
        verbose_logs: null,
        additional_metadata: this.additional_metadata || {}
      };
    }
  }
  
  /**
   * Success check method
   */
  protected _successCheck(): boolean {
    if (this.error !== undefined) {
      return false;
    }
    return this.score !== undefined && this.score >= this.threshold;
  }
  
  /**
   * Get the name of the scorer
   */
  get name(): string {
    return "Sample Scorer";
  }
}

/**
 * Run the example
 */
async function main() {
  try {
    // Initialize the JudgmentClient
    const client = JudgmentClient.getInstance();
    logger.info("Initialized JudgmentClient");

    // Create examples
    const examples = [
      new ExampleBuilder()
        .input("What is the capital of France?")
        .actualOutput("Paris is the capital of France.")
        .expectedOutput("Paris")
        .build(),
      new ExampleBuilder()
        .input("What is the capital of Italy?")
        .actualOutput("Rome is the capital of Italy.")
        .expectedOutput("Milan")
        .build()
    ];

    // Create a custom scorer
    const sampleScorer = new SampleScorer(
      0.5,              // threshold
      "Sample Scorer",  // score_type
      true,             // include_reason
      true,             // async_mode
      false,            // strict_mode
      true              // verbose_mode
    );

    logger.info("Running evaluation with custom scorer...");
    
    // Run evaluation using the JudgmentClient
    const results = await client.runEvaluation(
      examples,
      [sampleScorer],
      "gpt-3.5-turbo",  // model name
      undefined,        // aggregator
      {},               // metadata
      true,             // logResults
      "custom-scorer-example",  // projectName
      `sample-scorer-test-${Date.now()}`,  // evalRunName
      false,            // override
      false,            // useJudgment - run locally
      true,             // ignoreErrors
      false             // asyncExecution
    );
    
    logger.info(`Evaluation complete with ${results.length} results`);
    
    // Log success rate
    const successCount = results.filter((r: any) => 
      r.scorersData?.every((s: any) => s.success) ?? false
    ).length;
    
    logger.info(`Success rate: ${successCount}/${examples.length}`);
    
  } catch (error) {
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the example
main().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
