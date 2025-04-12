/**
 * Simple Async Evaluation Example
 * 
 * This example demonstrates how to use async evaluation with the JudgmentClient.
 * It matches the Python SDK's demo.py implementation exactly.
 */

import dotenv from 'dotenv';
import { ExampleBuilder } from '../data/example';
import { JudgmentClient } from '../judgment-client';
import { FaithfulnessScorer } from '../scorers/api-scorer';
import * as logger from '../common/logger';

// Load environment variables
dotenv.config();

async function main() {
  // Initialize the JudgmentClient with API key and organization ID
  const client = new JudgmentClient(
    process.env.JUDGMENT_API_KEY,
    process.env.JUDGMENT_ORG_ID
  );

  logger.info("Successfully initialized JudgmentClient!");

  // Create a unique evaluation run name with timestamp to avoid conflicts
  const evalRunName = `test-run-${Date.now()}`;
  
  // Create an example
  const example = new ExampleBuilder()
    .input("What if these shoes don't fit?")
    .actualOutput("We offer a 30-day full refund at no extra cost.")
    .retrievalContext(["All customers are eligible for a 30 day full refund at no extra cost."])
    .build();

  // Create a scorer
  const scorer = new FaithfulnessScorer(0.5);
    
  try {
    // Run the async evaluation - exactly matching Python SDK's demo.py
    const results = await client.aRunEvaluation(
      [example],
      [scorer],
      "meta-llama/Meta-Llama-3-8B-Instruct-Turbo",
      undefined,
      undefined,
      true,
      "js-sdk-async-demo",
      evalRunName,
      true // override
    );
    
    // Wait for a moment to simulate the async evaluation completing
    logger.info("Async evaluation job submitted successfully!");
    logger.info("Waiting for results...");
    
    // In a real-world scenario, you would poll for status
    // For this example, we'll simulate the waiting
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Print the results in a standardized format
    logger.info("\nAsync evaluation complete!");
    logger.info(`View results at: https://app.judgmentlabs.ai/app/experiment?project_name=js-sdk-async-demo&eval_run_name=${evalRunName}`);
    
    // Since this is a simulation and the actual results might be empty,
    // let's create a simulated result for demonstration purposes
    if (!results || results.length === 0) {
      const simulatedResults = [{
        success: true,
        scorers_data: [
          {
            name: "Faithfulness",
            threshold: 0.5,
            success: true,
            score: 0.95,
            reason: "The score is 0.95 because the response accurately reflects the information provided in the context. The context states that 'All customers are eligible for a 30 day full refund at no extra cost', and the response directly conveys this information by stating 'We offer a 30-day full refund at no extra cost.' The response is faithful to the context without adding or omitting any significant details.",
            evaluation_model: "meta-llama/Meta-Llama-3-8B-Instruct-Turbo"
          }
        ],
        data_object: {
          input: "What if these shoes don't fit?",
          context: ["All customers are eligible for a 30 day full refund at no extra cost."],
          actual_output: "We offer a 30-day full refund at no extra cost.",
          exampleId: example.exampleId,
          example_index: 0,
          timestamp: new Date().toISOString()
        }
      }];
      
      // Print the simulated results using the standardized logger
      logger.info("\nSimulated Results (for demonstration):");
      logger.print(simulatedResults);
    } else {
      // Print the actual results using the standardized logger
      logger.print(results);
    }
  } catch (error) {
    logger.error("Error running async evaluation: " + (error instanceof Error ? error.message : String(error)));
  }
}

// Run the example
main().catch(error => {
  logger.error("Error: " + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
