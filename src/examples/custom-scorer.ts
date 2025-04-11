/**
 * Custom Scorer Example
 * 
 * This example demonstrates how to create and use a custom scorer in the TypeScript SDK.
 * It implements a simple exact match scorer that compares the actual output with the expected output.
 */

import * as dotenv from 'dotenv';
import { Example, ExampleBuilder } from '../data/example';
import { JudgmentClient } from '../judgment-client';
import { JudgevalScorer } from '../scorers/base-scorer';
import { ScorerData, ScoringResult } from '../data/result';
import axios from 'axios';
import { JUDGMENT_EVAL_LOG_API_URL } from '../constants';

// Load environment variables
dotenv.config();

// Simple logger for the custom scorer example
const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
  print: (obj: any) => console.log(obj)
};

/**
 * ExactMatchScorer - A custom scorer that checks if the actual output exactly matches the expected output
 * 
 * This is a simple example of a custom scorer that extends the JudgevalScorer base class.
 * It demonstrates how to implement a local scorer that runs on the client side.
 */
class ExactMatchScorer extends JudgevalScorer {
  /**
   * Constructor for ExactMatchScorer
   * @param threshold Threshold for success (default: 1.0)
   * @param additional_metadata Additional metadata for the scorer
   * @param verbose Whether to include verbose logs
   */
  constructor(
    threshold: number = 1.0, 
    additional_metadata?: Record<string, any>, 
    verbose: boolean = false
  ) {
    super('exact_match', threshold, additional_metadata, verbose);
    this.validateThreshold();
  }

  /**
   * Score an example by comparing the actual output with the expected output
   * @param example The example to score
   * @returns A ScorerData object with the score and reason
   */
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

/**
 * Execute the custom scorer directly on examples
 * This function demonstrates how to use a custom scorer without relying on the JudgmentClient
 */
async function executeLocalScorer(examples: Example[], scorer: ExactMatchScorer): Promise<ScoringResult[]> {
  logger.info(`Executing local scorer: ${scorer.type}`);
  
  // Process each example with the scorer
  const results: ScoringResult[] = [];
  
  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    
    try {
      // Score the example using our custom scorer
      logger.info(`Scoring example ${i + 1}...`);
      const scorerData = await scorer.scoreExample(example);
      
      // Create a ScoringResult with the scorer data
      const result = new ScoringResult({
        dataObject: example,
        scorersData: [scorerData],
        error: undefined
      });
      
      results.push(result);
      
      logger.info(`Scored example ${i + 1}: ${scorerData.score} (${scorerData.success ? 'Pass' : 'Fail'})`);
    } catch (error) {
      // Handle any errors during scoring
      logger.error(`Error scoring example ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
      
      // Create a ScoringResult with the error
      const result = new ScoringResult({
        dataObject: example,
        scorersData: [],
        error: error instanceof Error ? error.message : String(error)
      });
      
      results.push(result);
    }
  }
  
  return results;
}

/**
 * Submit results to the Judgment server
 */
async function submitToServer(
  results: ScoringResult[],
  projectName: string,
  evalRunName: string,
  apiKey: string,
  orgId: string
): Promise<string> {
  logger.info("Submitting results to Judgment server...");
  
  // Prepare the API URL - ensure we use the correct API URL
  const apiUrl = 'https://api.judgmentlabs.ai/log_eval_results/';
  logger.info(`API URL: ${apiUrl}`);
  logger.info(`Project: ${projectName}`);
  logger.info(`Eval Run: ${evalRunName}`);
  
  // Prepare the request payload
  const payload = {
    project_name: projectName,
    eval_name: evalRunName, // Changed from eval_run_name to eval_name
    results: results.map(result => result.toJSON()) // Convert to JSON format
  };
  
  logger.info(`Prepared ${results.length} results for submission`);
  
  // Send the request to the server
  logger.info("Sending POST request to server...");
  try {
    const response = await axios.post(apiUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Organization-Id': orgId
      }
    });
    
    logger.info(`Server response status: ${response.status}`);
    
    if (response.status === 200) {
      logger.info("Results successfully submitted to server!");
      // Return the URL to view the results with the correct format
      return `https://app.judgmentlabs.ai/app/experiment?project_name=${projectName}&eval_run_name=${evalRunName}`;
    } else {
      throw new Error(`Request failed with status code ${response.status}`);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(`Error submitting results to server: ${error.message}`);
      logger.error(`Response status: ${error.response?.status}`);
      logger.error(`Response data: ${JSON.stringify(error.response?.data)}`);
    } else {
      logger.error(`Error submitting results to server: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw error;
  }
}

/**
 * Run the example
 */
async function main() {
  try {
    // Initialize the JudgmentClient
    const client = JudgmentClient.getInstance();
    logger.info("Successfully initialized JudgmentClient!");

    // Create examples with expected outputs
    const examples = [
      new ExampleBuilder()
        .input("What is the capital of France?")
        .actualOutput("Paris is the capital of France.")
        .expectedOutput("Paris is the capital of France.")
        .exampleIndex(0)
        .build(),
      new ExampleBuilder()
        .input("What is the capital of Italy?")
        .actualOutput("Rome is the capital of Italy.")
        .expectedOutput("The capital of Italy is Rome.")
        .exampleIndex(1)
        .build(),
      new ExampleBuilder()
        .input("What is the capital of Germany?")
        .actualOutput("Berlin is the capital of Germany.")
        .expectedOutput("Berlin is the capital of Germany.")
        .exampleIndex(2)
        .build()
    ];

    // Create a custom scorer
    const exactMatchScorer = new ExactMatchScorer(1.0, { description: "Checks for exact string match" }, true);

    // Define project and eval run names
    const projectName = "custom-scorer-example";
    const evalRunName = `exact-match-test-${Date.now()}`;
    
    logger.info("Running evaluation with custom ExactMatchScorer...");
    
    try {
      // STEP 1: Execute the local scorer directly (for demonstration)
      logger.info("STEP 1: Executing local scorer directly...");
      const results = await executeLocalScorer(examples, exactMatchScorer);
      
      logger.info(`Received ${results.length} results from local evaluation`);
      
      // Print the results
      logger.print(results);

      // Log success and failure counts
      const successCount = results.filter(r => {
        return r.scorersData?.every(s => s.success) ?? false;
      }).length;
      
      logger.info(`\n=== Custom Scorer Results ===`);
      logger.info(`Success rate: ${successCount}/${examples.length} (${(successCount/examples.length*100).toFixed(2)}%)`);
      
      // Show detailed results in a more readable format
      logger.info(`\n=== Detailed Results ===`);
      results.forEach((result, index) => {
        const example = examples[index];
        const scorerData = result.scorersData?.[0];
        
        logger.info(`\nExample ${index + 1} (index: ${example.exampleIndex}):`);
        logger.info(`Input: ${example.input}`);
        logger.info(`Actual: ${example.actualOutput}`);
        logger.info(`Expected: ${example.expectedOutput}`);
        logger.info(`Score: ${scorerData?.score} (${scorerData?.success ? 'Pass' : 'Fail'})`);
        logger.info(`Reason: ${scorerData?.reason}`);
      });
      
      // STEP 2: Submit results to the server (this actually stores in the database)
      logger.info("\n========================================");
      logger.info("STEP 2: Submitting results to the Judgment server...");
      logger.info("========================================\n");
      
      // Get API key and org ID from the client
      const apiKey = process.env.JUDGMENT_API_KEY || '';
      const orgId = process.env.JUDGMENT_ORG_ID || '';
      
      logger.info(`Checking environment variables:`);
      logger.info(`- JUDGMENT_API_KEY: ${apiKey ? 'Set' : 'NOT SET'}`);
      logger.info(`- JUDGMENT_ORG_ID: ${orgId ? 'Set' : 'NOT SET'}`);
      
      if (!apiKey || !orgId) {
        logger.error("Missing API key or organization ID. Cannot submit results to server.");
        logger.error("Please set JUDGMENT_API_KEY and JUDGMENT_ORG_ID environment variables.");
        return;
      }
      
      logger.info(`API Key: ${apiKey ? apiKey.substring(0, 3) + '...' + apiKey.substring(apiKey.length - 3) : 'Not set'}`);
      logger.info(`Organization ID: ${orgId ? orgId.substring(0, 3) + '...' + orgId.substring(orgId.length - 3) : 'Not set'}`);
      
      try {
        logger.info(`Attempting to submit results to server...`);
        const url = await submitToServer(results, projectName, evalRunName, apiKey, orgId);
        logger.info(`\nResults have been stored in the database.`);
        logger.info(`View results at: ${url}`);
      } catch (submitError) {
        logger.error("Error submitting results to server: " + (submitError instanceof Error ? submitError.message : String(submitError)));
        
        // Try using the JudgmentClient directly as an alternative
        logger.info("\nAttempting alternative method: Using JudgmentClient.runEvaluation() directly:");
        try {
          logger.info("Running evaluation with JudgmentClient...");
          const model = "gpt-3.5-turbo"; // Use a valid model name
          logger.info(`Using model: ${model}`);
          
          const clientResults = await client.runEvaluation(
            examples,
            [exactMatchScorer],
            model,
            projectName,
            {
              evalRunName: evalRunName,
              logResults: true
            }
          );
          
          logger.info(`JudgmentClient evaluation successful!`);
          logger.info(`Received ${clientResults.length} results from JudgmentClient`);
          logger.info(`View results at: https://app.judgmentlabs.ai/app/experiment?project_name=${projectName}&eval_run_name=${evalRunName}`);
        } catch (clientError) {
          logger.error("Error using JudgmentClient: " + (clientError instanceof Error ? clientError.message : String(clientError)));
        }
      }
      
      logger.info(`\nCustom scorer implementation complete!`);
    } catch (error) {
      logger.error("Error during evaluation: " + (error instanceof Error ? error.message : String(error)));
      logger.error("Stack trace: " + (error instanceof Error && error.stack ? error.stack : "No stack trace available"));
    }
    
  } catch (error) {
    logger.error("Error running custom scorer example: " + (error instanceof Error ? error.message : String(error)));
  }
}

// Run the example
main().catch(error => {
  logger.error("Unhandled error: " + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
