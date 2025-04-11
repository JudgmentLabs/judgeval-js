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

// Load environment variables
dotenv.config();

async function main() {
  // Initialize the JudgmentClient with API key and organization ID
  const client = new JudgmentClient(
    process.env.JUDGMENT_API_KEY,
    process.env.JUDGMENT_ORG_ID
  );

  console.log("Successfully initialized JudgmentClient!");

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
  
  console.log(`Starting async evaluation with run name: ${evalRunName}`);
  
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
    
    // Print the results - this will be an empty array for async evaluations
    console.log("Async evaluation submitted successfully!");
    console.log("Results:", results);
    
    console.log("\nYou can check the status of this evaluation using:");
    console.log(`const status = await client.checkEvalStatus("js-sdk-async-demo", "${evalRunName}");`);
    
    console.log("\nOr wait for it to complete using:");
    console.log(`const results = await client.waitForEvaluation("js-sdk-async-demo", "${evalRunName}");`);
    
    console.log("\nYou can also view the results in the Judgment UI at:");
    console.log(`https://app.judgmentlabs.ai/app/experiment?project_name=js-sdk-async-demo&eval_run_name=${evalRunName}`);
  } catch (error) {
    console.error("Error running async evaluation:", error);
  }
}

// Run the example
main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});
