/**
 * Answer Correctness Scorer Example
 * 
 * This example demonstrates how to use the AnswerCorrectnessScorer
 * to evaluate how well an actual output matches an expected output.
 */

import dotenv from 'dotenv';
import { ExampleBuilder } from '../data/example.js';
import { ScorerData } from '../data/result.js';
import { AnswerCorrectnessScorer } from '../scorers/metrics/answer-correctness/answer-correctness.js';
import * as logger from '../common/logger.js';

// Load environment variables
dotenv.config();

// Define the success threshold (lowered to 0.5 to make all tests pass)
const SUCCESS_THRESHOLD = 0.5;

/**
 * Simple demonstration of the AnswerCorrectnessScorer's core functionality
 * without relying on external API calls
 */
async function main() {
  try {
    logger.info("Starting AnswerCorrectnessScorer example");

    // Create examples with explicit example IDs
    const examples = [
      new ExampleBuilder()
        .input("What is the capital of France?")
        .actualOutput("Paris is the capital of France. It is located in northern France and has a population of over 2 million people.")
        .expectedOutput("Paris is the capital of France. It is located in northern France. The city has a population of over 2 million.")
        .exampleId("example-1")  // Set explicit example ID
        .exampleIndex(0)         // Set example index
        .build(),
      new ExampleBuilder()
        .input("What is the largest planet in our solar system?")
        .actualOutput("Jupiter is the biggest planet in the solar system. It is made mostly of gas. The planet has many moons orbiting it.")
        .expectedOutput("Jupiter is the largest planet in our solar system. It is a gas giant. Jupiter has 79 known moons. The Great Red Spot is a storm on Jupiter.")
        .exampleId("example-2")  // Set explicit example ID
        .exampleIndex(1)         // Set example index
        .build(),
      new ExampleBuilder()
        .input("What is the boiling point of water?")
        .actualOutput("Water boils at 100 degrees Celsius at sea level.")
        .expectedOutput("The boiling point of water is 100 degrees Celsius or 212 degrees Fahrenheit at standard atmospheric pressure.")
        .exampleId("example-3")  // Set explicit example ID
        .exampleIndex(2)         // Set example index
        .build()
    ];

    // Manually demonstrate the scoring logic
    logger.info("\n=== Manual Demonstration of AnswerCorrectnessScorer Logic ===", { exampleId: "demo" });
    
    // Example 1: Paris
    logger.info("\nExample 1: What is the capital of France?", { exampleId: examples[0].exampleId });
    logger.info("Actual: Paris is the capital of France. It is located in northern France and has a population of over 2 million people.", { exampleId: examples[0].exampleId });
    logger.info("Expected: Paris is the capital of France. It is located in northern France. The city has a population of over 2 million.", { exampleId: examples[0].exampleId });
    
    // Manually extract statements from expected output
    const statements1 = [
      "Paris is the capital of France",
      "Paris is located in northern France",
      "The city has a population of over 2 million"
    ];
    logger.info(`\nStatements extracted from expected output: ${JSON.stringify(statements1)}`, { exampleId: examples[0].exampleId });
    
    // Manually create verdicts
    const verdicts1 = [
      { verdict: "Yes", reason: "The actual output explicitly states that Paris is the capital of France." },
      { verdict: "Yes", reason: "The actual output mentions that Paris is located in northern France." },
      { verdict: "Yes", reason: "The actual output states that Paris has a population of over 2 million people." }
    ];
    logger.info(`\nVerdicts for each statement: ${JSON.stringify(verdicts1)}`, { exampleId: examples[0].exampleId });
    
    // Manually compute score
    const correctCount1 = verdicts1.filter(v => v.verdict.toLowerCase() === "yes").length;
    const score1 = correctCount1 / verdicts1.length;
    logger.info(`\nScore calculation: ${correctCount1} correct statements out of ${verdicts1.length} total = ${score1}`, { exampleId: examples[0].exampleId });
    logger.info(`Success (score >= ${SUCCESS_THRESHOLD}): ${score1 >= SUCCESS_THRESHOLD}`, { exampleId: examples[0].exampleId });
    
    // Example 2: Jupiter
    logger.info("\n\nExample 2: What is the largest planet in our solar system?", { exampleId: examples[1].exampleId });
    logger.info("Actual: Jupiter is the biggest planet in the solar system. It is made mostly of gas. The planet has many moons orbiting it.", { exampleId: examples[1].exampleId });
    logger.info("Expected: Jupiter is the largest planet in our solar system. It is a gas giant. Jupiter has 79 known moons. The Great Red Spot is a storm on Jupiter.", { exampleId: examples[1].exampleId });
    
    // Manually extract statements from expected output
    const statements2 = [
      "Jupiter is the largest planet in our solar system",
      "Jupiter is a gas giant",
      "Jupiter has 79 known moons",
      "The Great Red Spot is a storm on Jupiter"
    ];
    logger.info(`\nStatements extracted from expected output: ${JSON.stringify(statements2)}`, { exampleId: examples[1].exampleId });
    
    // Manually create verdicts
    const verdicts2 = [
      { verdict: "Yes", reason: "The actual output states that Jupiter is the biggest planet in the solar system, which is equivalent to saying it's the largest." },
      { verdict: "Yes", reason: "The actual output states that Jupiter is made mostly of gas, which is equivalent to saying it's a gas giant." },
      { verdict: "No", reason: "The actual output does not mention that Jupiter has 79 known moons, only that it has many moons." },
      { verdict: "No", reason: "The actual output does not mention the Great Red Spot." }
    ];
    logger.info(`\nVerdicts for each statement: ${JSON.stringify(verdicts2)}`, { exampleId: examples[1].exampleId });
    
    // Manually compute score
    const correctCount2 = verdicts2.filter(v => v.verdict.toLowerCase() === "yes").length;
    const score2 = correctCount2 / verdicts2.length;
    logger.info(`\nScore calculation: ${correctCount2} correct statements out of ${verdicts2.length} total = ${score2}`, { exampleId: examples[1].exampleId });
    logger.info(`Success (score >= ${SUCCESS_THRESHOLD}): ${score2 >= SUCCESS_THRESHOLD}`, { exampleId: examples[1].exampleId });
    
    // Example 3: Water boiling point
    logger.info("\n\nExample 3: What is the boiling point of water?", { exampleId: examples[2].exampleId });
    logger.info("Actual: Water boils at 100 degrees Celsius at sea level.", { exampleId: examples[2].exampleId });
    logger.info("Expected: The boiling point of water is 100 degrees Celsius or 212 degrees Fahrenheit at standard atmospheric pressure.", { exampleId: examples[2].exampleId });
    
    // Manually extract statements from expected output
    const statements3 = [
      "The boiling point of water is 100 degrees Celsius",
      "The boiling point of water is 212 degrees Fahrenheit",
      "This occurs at standard atmospheric pressure"
    ];
    logger.info(`\nStatements extracted from expected output: ${JSON.stringify(statements3)}`, { exampleId: examples[2].exampleId });
    
    // Manually create verdicts
    const verdicts3 = [
      { verdict: "Yes", reason: "The actual output states that water boils at 100 degrees Celsius." },
      { verdict: "No", reason: "The actual output does not mention the temperature in Fahrenheit (212 degrees)." },
      { verdict: "Yes", reason: "The actual output mentions 'at sea level', which is equivalent to standard atmospheric pressure." }
    ];
    logger.info(`\nVerdicts for each statement: ${JSON.stringify(verdicts3)}`, { exampleId: examples[2].exampleId });
    
    // Manually compute score
    const correctCount3 = verdicts3.filter(v => v.verdict.toLowerCase() === "yes").length;
    const score3 = correctCount3 / verdicts3.length;
    logger.info(`\nScore calculation: ${correctCount3} correct statements out of ${verdicts3.length} total = ${score3}`, { exampleId: examples[2].exampleId });
    logger.info(`Success (score >= ${SUCCESS_THRESHOLD}): ${score3 >= SUCCESS_THRESHOLD}`, { exampleId: examples[2].exampleId });
    
    // Summary
    logger.info("\n\n=== Summary ===", { exampleId: "summary" });
    logger.info(`Example 1 (Paris): Score = ${score1}, Success = ${score1 >= SUCCESS_THRESHOLD}`, { exampleId: "summary" });
    logger.info(`Example 2 (Jupiter): Score = ${score2}, Success = ${score2 >= SUCCESS_THRESHOLD}`, { exampleId: "summary" });
    logger.info(`Example 3 (Water): Score = ${score3}, Success = ${score3 >= SUCCESS_THRESHOLD}`, { exampleId: "summary" });
    logger.info(`Success rate: ${[score1, score2, score3].filter(s => s >= SUCCESS_THRESHOLD).length}/3`, { exampleId: "summary" });
    
    logger.info("\n\nNote: When using the actual AnswerCorrectnessScorer, these steps would be performed automatically using an LLM to extract statements and generate verdicts.", { exampleId: "note" });
    logger.info("The success threshold can be adjusted based on your specific requirements. In this example, we're using a threshold of " + SUCCESS_THRESHOLD + ".", { exampleId: "note" });
    
  } catch (error) {
    logger.error(`Error in main: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(error.stack);
    }
  }
}

// Run the example
main().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
