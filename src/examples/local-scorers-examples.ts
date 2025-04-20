/**
 * Local Scorers Examples
 * 
 * This file contains examples for all local scorers implemented in the JudgEval TypeScript SDK.
 */

import dotenv from 'dotenv';
import { Example } from '../data/example.js';
import { AnswerCorrectnessScorer } from '../scorers/metrics/answer-correctness/answer-correctness.js';
import { AnswerRelevancyScorer } from '../scorers/metrics/answer-relevancy/answer-relevancy.js';
import { FaithfulnessScorer } from '../scorers/metrics/faithfulness/faithfulness.js';
import { HallucinationScorer } from '../scorers/metrics/hallucination/index.js';
import { InstructionAdherenceScorer } from '../scorers/metrics/instruction-adherence/instruction-adherence.js';
import * as logger from '../common/logger.js';
import { Judge, DefaultJudge } from '../judges/index.js';
import { ScorerData } from '../data/result.js';

// Load environment variables
dotenv.config();

// Define a test example with a unique ID
const testExample = new Example({
  input: "What is the capital of France?",
  actualOutput: "Paris is the capital of France. It is located in northern France and has a population of over 2 million people.",
  expectedOutput: "The capital of France is Paris.",
  retrievalContext: ["Paris is the capital and most populous city of France. It is located in the north-central part of the country."],
  context: ["Paris is the capital and most populous city of France. It is located in the north-central part of the country."],
  exampleId: "test-example-123"
});

/**
 * Run a single scorer and return the result
 */
async function runScorer(example: Example, judge: Judge, scorer: any): Promise<ScorerData> {
  return await scorer.scoreExample(example);
}

// Main function to run the example
async function runLocalScorersTest() {
  // Set a success threshold
  const SUCCESS_THRESHOLD = 0.5;
  const exampleId = testExample.exampleId;
  
  logger.info("Starting local scorers examples", { exampleId });
  
  const modelName = 'gpt-3.5-turbo';
  logger.info(`Using OpenAI model: ${modelName} (cheapest option)`, { exampleId });
  
  try {
    // Initialize the judge with the API key from the environment
    const judge = new DefaultJudge(modelName, process.env.OPENAI_API_KEY);
    
    // Run all scorers with real API calls
    logger.info("\n========== TESTING ALL LOCAL SCORERS WITH REAL API CALLS ==========", { exampleId });
    
    // Test AnswerCorrectnessScorer
    logger.info("\n=== Testing AnswerCorrectnessScorer ===", { exampleId });
    const answerCorrectnessScorer = new AnswerCorrectnessScorer(SUCCESS_THRESHOLD, judge, true, false, false, true);
    const answerCorrectnessResult = await runScorer(testExample, judge, answerCorrectnessScorer);
    logger.print(answerCorrectnessResult);
    
    // Test AnswerRelevancyScorer
    logger.info("\n=== Testing AnswerRelevancyScorer ===", { exampleId });
    const answerRelevancyScorer = new AnswerRelevancyScorer(SUCCESS_THRESHOLD, judge, true, false, false, true);
    const answerRelevancyResult = await runScorer(testExample, judge, answerRelevancyScorer);
    logger.print(answerRelevancyResult);
    
    // Test FaithfulnessScorer
    logger.info("\n=== Testing FaithfulnessScorer ===", { exampleId });
    const faithfulnessScorer = new FaithfulnessScorer(SUCCESS_THRESHOLD, judge, true, false, false, true);
    const faithfulnessResult = await runScorer(testExample, judge, faithfulnessScorer);
    logger.print(faithfulnessResult);
    
    // Test HallucinationScorer
    logger.info("\n=== Testing HallucinationScorer ===", { exampleId });
    const hallucinationScorer = new HallucinationScorer(SUCCESS_THRESHOLD, judge, true, false, false, true);
    const hallucinationResult = await runScorer(testExample, judge, hallucinationScorer);
    logger.print(hallucinationResult);
    
    // Test InstructionAdherenceScorer
    logger.info("\n=== Testing InstructionAdherenceScorer ===", { exampleId });
    const instructionAdherenceScorer = new InstructionAdherenceScorer(SUCCESS_THRESHOLD, judge, true, false, false, true);
    const instructionAdherenceResult = await runScorer(testExample, judge, instructionAdherenceScorer);
    logger.print(instructionAdherenceResult);
    
    logger.info("\nAll local scorers tested successfully with real API calls!", { exampleId });
  } catch (error) {
    logger.error(`Error running local scorers test: ${error}`, { exampleId });
  }
}

// Run the test
runLocalScorersTest().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
