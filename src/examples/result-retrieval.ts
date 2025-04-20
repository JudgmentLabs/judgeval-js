/**
 * Example demonstrating how to retrieve evaluation results from the Judgment API.
 * 
 * This example shows:
 * 1. How to run an evaluation using the API
 * 2. How to retrieve the results using the pullEval method
 * 
 * Note: There is a known server-side limitation that may cause an error with the message
 * "object of type 'NoneType' has no len()" when trying to retrieve results. This example
 * demonstrates how to handle this error gracefully.
 */

import { JudgmentClient } from '../judgment-client.js';
import { Example } from '../data/example.js';
import { AnswerCorrectnessScorer } from '../scorers/api-scorer.js';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  // Initialize the JudgmentClient
  const client = JudgmentClient.getInstance();
  
  // Define project and evaluation run names
  const projectName = "judgeval-js-examples";
  const evalRunName = `api-test-${Date.now()}`;
  
  console.log(`Running API evaluation with project name "${projectName}" and eval run name "${evalRunName}"...`);
  
  // Create examples for evaluation
  const examples = [
    new Example({
      input: "What is the capital of France?",
      actualOutput: "Paris is the capital of France.",
      expectedOutput: "Paris is the capital of France."
    }),
    new Example({
      input: "What is the capital of Italy?",
      actualOutput: "Rome is the capital of Italy.",
      expectedOutput: "The capital of Italy is Rome."
    })
  ];
  
  try {
    // Run evaluation using the evaluate method (similar to basic-evaluation.ts)
    console.log("Running evaluation with API scorer...");
    const results = await client.evaluate({
      examples: examples,
      scorers: [new AnswerCorrectnessScorer(0.7)],
      model: "gpt-3.5-turbo",
      projectName: projectName,
      evalName: evalRunName,
      logResults: true
    });
    
    console.log(`API evaluation completed with ${results.length} results.`);
    
    // Display the evaluation results directly from the API response
    console.log("\nEvaluation results from API response:");
    results.forEach((result, index) => {
      const dataObj = result.dataObject as any; // Use type assertion to avoid TypeScript errors
      
      console.log(`\nResult ${index + 1}:`);
      console.log(`Input: ${dataObj.input}`);
      console.log(`Actual Output: ${dataObj.actualOutput || dataObj.actual_output}`);
      console.log(`Expected Output: ${dataObj.expectedOutput || dataObj.expected_output}`);
      
      if (result.scorersData && result.scorersData.length > 0) {
        const scorerData = result.scorersData[0];
        console.log(`Score: ${scorerData.score}`);
        console.log(`Success: ${scorerData.success}`);
        console.log(`Reason: ${scorerData.reason}`);
      } else {
        console.log("No scorer data available");
      }
    });
    
    // Wait for the API to process the results
    console.log("\nWaiting for API to process results (5 seconds)...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Attempt to retrieve results from the API
    console.log(`\nAttempting to retrieve results from API for project "${projectName}" and eval run "${evalRunName}"...`);
    try {
      const apiResults = await client.pullEval(projectName, evalRunName);
      console.log(`Successfully retrieved results from API.`);
      
      // Display results in a more readable format
      console.log(`\nAPI Results: ${JSON.stringify(apiResults, null, 2)}`);
      
      // Process results to display in a more user-friendly format
      if (Array.isArray(apiResults) && apiResults.length > 0) {
        console.log("\nProcessed API Results:");
        apiResults.forEach((result, index) => {
          console.log(`\nResult ${index + 1}:`);
          
          // Display result ID and creation time
          console.log(`ID: ${result.id}`);
          console.log(`Created at: ${result.created_at}`);
          
          // Display scorer data
          if (result.result && result.result.scorers_data) {
            const scorerData = result.result.scorers_data[0];
            console.log(`Score: ${scorerData.score}`);
            console.log(`Success: ${scorerData.success}`);
            console.log(`Reason: ${scorerData.reason}`);
            console.log(`Evaluation model: ${scorerData.evaluation_model}`);
          }
          
          // Display example data
          if (result.examples && result.examples.length > 0) {
            const example = result.examples[0];
            console.log(`Example ID: ${example.example_id}`);
            console.log(`Input: ${example.input}`);
          }
        });
      }
    } catch (error) {
      console.error(`Error retrieving API results: ${error instanceof Error ? error.message : String(error)}`);
      console.log("\nNote: This is a known server-side limitation. The server is returning an error");
      console.log("when trying to retrieve results. However, the evaluation was successful, and");
      console.log("you can see the results above from the direct API response.");
    }
  } catch (error) {
    console.error(`Error in example: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the example
main().catch(error => {
  console.error(`Unhandled error in example: ${error instanceof Error ? error.message : String(error)}`);
});
