/**
 * This example demonstrates how the TypeScript SDK's result retrieval functionality
 * aligns with the Python SDK's implementation.
 * 
 * Python SDK equivalent:
 * ```python
 * from judgeval import JudgmentClient
 * 
 * # Initialize client
 * client = JudgmentClient()
 * 
 * # Retrieve evaluation results
 * results = client.pull_eval("my-project", "my-eval-run")
 * 
 * # Get evaluation run ID and results
 * eval_id = results[0]["id"]
 * eval_results = results[0]["results"]
 * 
 * # Print results
 * print(f"Evaluation ID: {eval_id}")
 * print(f"Number of results: {len(eval_results)}")
 * ```
 */

import dotenv from 'dotenv';
import { JudgmentClient } from '../judgment-client.js';
import { ExampleBuilder } from '../data/example.js';
import { SampleScorer } from './custom-scorer.js';

// Load environment variables
dotenv.config();

/**
 * Main function to demonstrate alignment with Python SDK
 */
async function main() {
  try {
    // Initialize the JudgmentClient (same as Python's JudgmentClient())
    const client = JudgmentClient.getInstance();
    console.log("Successfully initialized JudgmentClient!");

    // Define project and eval run names
    const projectName = "typescript-python-comparison";
    const evalRunName = `comparison-test-${Date.now()}`;

    // First, create some evaluation results to retrieve
    console.log(`\nCreating evaluation with project name "${projectName}" and eval run name "${evalRunName}"...`);
    
    // Create examples (similar to Python SDK's Example objects)
    const examples = [
      new ExampleBuilder()
        .input("What is 2+2?")
        .actualOutput("4")
        .expectedOutput("4")
        .exampleIndex(0)
        .build(),
      new ExampleBuilder()
        .input("What is the capital of France?")
        .actualOutput("Paris")
        .expectedOutput("Paris")
        .exampleIndex(1)
        .build()
    ];

    // Create a scorer (similar to Python SDK's ExactMatchScorer)
    const sampleScorer = new SampleScorer(1.0);

    // Run evaluation (similar to Python SDK's run_evaluation)
    await client.runEvaluation(
      examples,
      [sampleScorer],
      "gpt-3.5-turbo",
      undefined,
      { description: "Comparison with Python SDK" },
      true,
      projectName,
      evalRunName
    );

    console.log("Evaluation completed successfully!");

    // Now retrieve the results using pullEval (equivalent to Python's pull_eval)
    console.log("\nRetrieving results using pullEval (equivalent to Python's pull_eval)...");
    
    try {
      // TypeScript: const results = await client.pullEval(projectName, evalRunName);
      // Python:     results = client.pull_eval(project_name, eval_run_name)
      const results = await client.pullEval(projectName, evalRunName);
      
      // TypeScript: const evalId = results[0]?.id;
      // Python:     eval_id = results[0]["id"]
      const evalId = results[0]?.id;
      
      // TypeScript: const evalResults = results[0]?.results;
      // Python:     eval_results = results[0]["results"]
      const evalResults = results[0]?.results;
      
      // Print results (same as Python)
      console.log(`Evaluation ID: ${evalId}`);
      console.log(`Number of results: ${evalResults?.length || 0}`);
      
      // Demonstrate that the structure matches Python SDK
      console.log("\nResult structure (matches Python SDK):");
      console.log("- results[0].id (Python: results[0][\"id\"])");
      console.log("- results[0].results (Python: results[0][\"results\"])");
      console.log("- results[0].results[0].dataObject (Python: results[0][\"results\"][0].data_object)");
      console.log("- results[0].results[0].scorersData (Python: results[0][\"results\"][0].scorers_data)");
      
      // Show the first result in detail
      if (evalResults && evalResults.length > 0) {
        const firstResult = evalResults[0];
        console.log("\nFirst result details:");
        console.log(`Score: ${firstResult.scorersData?.[0]?.score}`);
        console.log(`Success: ${firstResult.scorersData?.[0]?.success}`);
      }
      
      // Demonstrate other result retrieval methods
      console.log("\nOther result retrieval methods (also match Python SDK):");
      
      // exportEvalResults (similar to Python's export_eval_results if it existed)
      console.log("- exportEvalResults() → Exports results in JSON or CSV format");
      
    } catch (error) {
      console.error(`Error retrieving results: ${error}`);
    }

    console.log("\nComparison with Python SDK completed!");
    
  } catch (error) {
    console.error("Error in comparison example:", error);
  }
}

// Run the example
main().catch(console.error);
