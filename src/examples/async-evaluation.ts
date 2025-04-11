/**
 * Async Evaluation Example
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
  // Initialize the JudgmentClient
  const client = new JudgmentClient(
    process.env.JUDGMENT_API_KEY,
    process.env.JUDGMENT_ORG_ID
  );

  console.log("Successfully initialized JudgmentClient!");

  // Create an example
  const example = new ExampleBuilder()
    .input("What if these shoes don't fit?")
    .actualOutput("We offer a 30-day full refund at no extra cost.")
    .retrievalContext(["All customers are eligible for a 30 day full refund at no extra cost."])
    .build();

  // Create a scorer
  const scorer = new FaithfulnessScorer(0.5);
  
  // Run the async evaluation - exactly matching Python SDK's demo.py
  const results = await client.aRunEvaluation(
    [example],
    [scorer],
    "meta-llama/Meta-Llama-3-8B-Instruct-Turbo",
    undefined,
    undefined,
    true,
    "default_project",
    "test-run",
    true // override
  );
  
  // Print the results - this will be an empty array for async evaluations
  console.log(results);
}

// Run the example
main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});
