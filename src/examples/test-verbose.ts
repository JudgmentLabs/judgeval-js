import dotenv from 'dotenv';
import { JudgmentClient } from '../judgment-client';
import { ExampleBuilder } from '../data/example';
import { AnswerRelevancyScorer } from '../scorers/api-scorer';
import logger from '../common/logger';

// Load environment variables from .env file
dotenv.config();

/**
 * This script tests the verbose flag functionality in the TypeScript SDK
 * It runs a single evaluation with the verbose flag enabled to check if the reason field is populated
 */
async function main() {
  try {
    // Initialize the JudgmentClient
    const judgmentClient = JudgmentClient.getInstance();

    // Create a more complex example that should trigger a detailed reason
    const example = new ExampleBuilder()
      .input("What's the capital of France and what is it known for?")
      .actualOutput("The capital of France is Paris. It's known for the Eiffel Tower, Louvre Museum, and being a center of art, fashion, and culture. Paris is often called the 'City of Light' due to its role during the Age of Enlightenment and its early adoption of street lighting.")
      .build();

    // Run evaluation with verbose flag
    const results = await judgmentClient.evaluate({
      examples: [example],
      scorers: [new AnswerRelevancyScorer(0.7, {}, true)], // Enable verbose mode
      evalName: `verbose-test-${Date.now()}`,
      projectName: 'js-sdk-verbose-test',
      model: 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo'  // Use a supported model
    });

    // Use simplified print function - matches Python SDK's print(results) behavior
    logger.print(results);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
