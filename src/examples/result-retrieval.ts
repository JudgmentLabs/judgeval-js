/**
 * Example demonstrating how to retrieve evaluation results
 */
import { JudgmentClient } from '../judgment-client.js';
import { ExampleBuilder } from '../data/example.js';
import { ExactMatchScorer } from '../scorers/exact-match-scorer.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Main function to demonstrate result retrieval
 */
async function main() {
  try {
    // Initialize the JudgmentClient
    const client = JudgmentClient.getInstance();
    console.log("Successfully initialized JudgmentClient!");

    // Define project and eval run names
    const projectName = "result-retrieval-example";
    const evalRunName = `exact-match-test-${Date.now()}`;

    // Step 1: Run a simple evaluation to create results
    console.log(`\nStep 1: Running evaluation with project name "${projectName}" and eval run name "${evalRunName}"...`);
    
    // Create examples
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

    // Create a scorer
    const exactMatchScorer = new ExactMatchScorer(1.0);

    // Run evaluation
    await client.runEvaluation(
      examples,
      [exactMatchScorer],
      "gpt-3.5-turbo", // Use a valid model name
      undefined,
      { description: "Example for result retrieval" },
      true, // Log results
      projectName,
      evalRunName
    );

    console.log("Evaluation completed successfully!");

    // Step 2: Retrieve the evaluation results
    console.log("\nStep 2: Retrieving evaluation results...");
    
    // Using pullEval
    console.log("\nUsing pullEval()");
    try {
      const results1 = await client.pullEval(projectName, evalRunName);
      console.log(`Retrieved ${results1[0]?.results?.length || 0} results using pullEval()`);
    } catch (error) {
      console.error(`Error retrieving results with pullEval(): ${error}`);
    }

    // Step 3: Export the evaluation results
    console.log("\nStep 3: Exporting evaluation results...");
    try {
      // Export as JSON
      const jsonResults = await client.exportEvalResults(projectName, evalRunName, 'json');
      console.log(`Exported JSON results (${jsonResults.length} characters)`);
      
      // Export as CSV
      const csvResults = await client.exportEvalResults(projectName, evalRunName, 'csv');
      console.log(`Exported CSV results (${csvResults.length} characters)`);
    } catch (error) {
      console.error(`Error exporting evaluation results: ${error}`);
    }

    console.log("\nResult retrieval example completed.");
    
  } catch (error) {
    console.error("Error in result retrieval example:", error);
  }
}

// Run the example
main().catch(console.error);
