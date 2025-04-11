/**
 * Example demonstrating how to retrieve evaluation results
 */
import { JudgmentClient } from '../judgment-client';
import { ExampleBuilder } from '../data/example';
import { ExactMatchScorer } from '../scorers/exact-match-scorer';
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
    
    // Method 1: Using pullEval
    console.log("\nMethod 1: Using pullEval()");
    try {
      const results1 = await client.pullEval(projectName, evalRunName);
      console.log(`Retrieved ${results1[0]?.results?.length || 0} results using pullEval()`);
      console.log(`Evaluation ID: ${results1[0]?.id}`);
    } catch (error) {
      console.error(`Error retrieving results with pullEval(): ${error}`);
    }

    // Method 2: Using getEvalRun (alias for pullEval)
    console.log("\nMethod 2: Using getEvalRun()");
    try {
      const results2 = await client.getEvalRun(projectName, evalRunName);
      console.log(`Retrieved ${results2[0]?.results?.length || 0} results using getEvalRun()`);
    } catch (error) {
      console.error(`Error retrieving results with getEvalRun(): ${error}`);
    }

    // Step 3: List all evaluation runs for the project
    console.log("\nStep 3: Listing all evaluation runs for the project...");
    try {
      const evalRuns = await client.listEvalRuns(projectName);
      console.log(`Found ${evalRuns.length} evaluation runs for project "${projectName}"`);
      
      // Display the most recent runs
      if (evalRuns.length > 0) {
        console.log("\nMost recent evaluation runs:");
        evalRuns.slice(0, 3).forEach((run, index) => {
          console.log(`${index + 1}. ${run.eval_name || run.name} (${run.created_at || 'unknown date'})`);
        });
      }
    } catch (error) {
      console.error(`Error listing evaluation runs: ${error}`);
    }

    // Step 4: Get statistics for the evaluation run
    console.log("\nStep 4: Getting statistics for the evaluation run...");
    try {
      const stats = await client.getEvalRunStats(projectName, evalRunName);
      console.log("Evaluation run statistics:");
      console.log(`- Total examples: ${stats.total_examples || 'N/A'}`);
      console.log(`- Success rate: ${stats.success_rate || 'N/A'}`);
      console.log(`- Average score: ${stats.average_score || 'N/A'}`);
    } catch (error) {
      console.error(`Error getting evaluation run statistics: ${error}`);
    }

    // Step 5: Export the evaluation results
    console.log("\nStep 5: Exporting evaluation results...");
    try {
      // Export as JSON
      const jsonExport = await client.exportEvalResults(projectName, evalRunName, 'json');
      console.log("Exported JSON results (first 100 characters):");
      console.log(jsonExport.substring(0, 100) + "...");
      
      // Export as CSV
      const csvExport = await client.exportEvalResults(projectName, evalRunName, 'csv');
      console.log("Exported CSV results (first 100 characters):");
      console.log(csvExport);
    } catch (error) {
      console.error(`Error exporting evaluation results: ${error}`);
    }

    console.log("\nResult retrieval example completed!");
    
  } catch (error) {
    console.error("Error in result retrieval example:", error);
  }
}

// Run the example
main().catch(console.error);
