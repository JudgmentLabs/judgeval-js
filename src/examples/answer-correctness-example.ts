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

/**
 * Run the example
 */
async function main() {
  try {
    logger.info("Starting AnswerCorrectnessScorer example");

    // Create examples
    const examples = [
      new ExampleBuilder()
        .input("What is the capital of France?")
        .actualOutput("Paris is the capital of France. It is located in northern France and has a population of over 2 million people.")
        .expectedOutput("Paris is the capital of France. It is located in northern France. The city has a population of over 2 million.")
        .build(),
      new ExampleBuilder()
        .input("What is the largest planet in our solar system?")
        .actualOutput("Jupiter is the biggest planet in the solar system. It is made mostly of gas. The planet has many moons orbiting it.")
        .expectedOutput("Jupiter is the largest planet in our solar system. It is a gas giant. Jupiter has 79 known moons. The Great Red Spot is a storm on Jupiter.")
        .build(),
      new ExampleBuilder()
        .input("What is the boiling point of water?")
        .actualOutput("Water boils at 100 degrees Celsius at sea level.")
        .expectedOutput("The boiling point of water is 100 degrees Celsius or 212 degrees Fahrenheit at standard atmospheric pressure.")
        .build()
    ];

    // Create an AnswerCorrectnessScorer with a model that doesn't have rate limiting issues
    const scorer = new AnswerCorrectnessScorer(
      0.7,                                    // threshold
      'gpt-4',                                // model - using GPT-4 to avoid rate limiting issues with gpt-3.5-turbo
      true,                                   // include_reason
      true,                                   // async_mode
      false,                                  // strict_mode
      true                                    // verbose_mode
    );

    logger.info("Running evaluation with AnswerCorrectnessScorer...");
    
    // Process each example
    const results: ScorerData[] = [];
    for (const example of examples) {
      logger.info(`\nProcessing example: ${example.input}`);
      const result = await scorer.scoreExample(example);
      results.push(result);
      
      logger.info(`\n--- Example Results ---`);
      logger.info(`Input: ${example.input}`);
      logger.info(`Actual Output: ${example.actualOutput}`);
      logger.info(`Expected Output: ${example.expectedOutput}`);
      logger.info(`Score: ${result.score}`);
      logger.info(`Success: ${result.success}`);
      logger.info(`Reason: ${result.reason}`);
      
      if (result.verbose_logs) {
        logger.info(`\nVerbose Logs:\n${result.verbose_logs}`);
      }
    }
    
    // Log success rate
    const successCount = results.filter(r => r.success).length;
    logger.info(`\nSuccess rate: ${successCount}/${examples.length}`);
    
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
