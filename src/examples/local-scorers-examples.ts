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
 * Run all scorers function - demonstrates how to use local scorers with a Judge
 */
async function runAllScorers(example: Example, judge: Judge, threshold: number, useAsync: boolean = true): Promise<ScorerData[]> {
  const results: ScorerData[] = [];
  const exampleId = example.exampleId;
  
  // Test AnswerCorrectnessScorer
  logger.info("\n=== Testing AnswerCorrectnessScorer ===", { exampleId });
  const answerCorrectnessScorer = new AnswerCorrectnessScorer(threshold, judge, useAsync, false, false, true);
  const answerCorrectnessResult = await answerCorrectnessScorer.scoreExample(example);
  results.push(answerCorrectnessResult);
  logger.info(`Score: ${answerCorrectnessResult.score}`, { exampleId });
  logger.info(`Success: ${answerCorrectnessResult.success}`, { exampleId });
  logger.info(`Reason: ${answerCorrectnessResult.reason}`, { exampleId });
  
  // Test AnswerRelevancyScorer
  logger.info("\n=== Testing AnswerRelevancyScorer ===", { exampleId });
  const answerRelevancyScorer = new AnswerRelevancyScorer(threshold, judge, useAsync, false, false, true);
  const answerRelevancyResult = await answerRelevancyScorer.scoreExample(example);
  results.push(answerRelevancyResult);
  logger.info(`Score: ${answerRelevancyResult.score}`, { exampleId });
  logger.info(`Success: ${answerRelevancyResult.success}`, { exampleId });
  logger.info(`Reason: ${answerRelevancyResult.reason}`, { exampleId });
  
  // Test FaithfulnessScorer
  logger.info("\n=== Testing FaithfulnessScorer ===", { exampleId });
  const faithfulnessScorer = new FaithfulnessScorer(threshold, judge, useAsync, false, false, true);
  const faithfulnessResult = await faithfulnessScorer.scoreExample(example);
  results.push(faithfulnessResult);
  logger.info(`Score: ${faithfulnessResult.score}`, { exampleId });
  logger.info(`Success: ${faithfulnessResult.success}`, { exampleId });
  logger.info(`Reason: ${faithfulnessResult.reason}`, { exampleId });
  
  // Test HallucinationScorer
  logger.info("\n=== Testing HallucinationScorer ===", { exampleId });
  const hallucinationScorer = new HallucinationScorer(threshold, judge, useAsync, false, false, true);
  const hallucinationResult = await hallucinationScorer.scoreExample(example);
  results.push(hallucinationResult);
  logger.info(`Score: ${hallucinationResult.score}`, { exampleId });
  logger.info(`Success: ${hallucinationResult.success}`, { exampleId });
  logger.info(`Reason: ${hallucinationResult.reason}`, { exampleId });
  
  // Test InstructionAdherenceScorer
  logger.info("\n=== Testing InstructionAdherenceScorer ===", { exampleId });
  const instructionAdherenceScorer = new InstructionAdherenceScorer(threshold, judge, useAsync, false, false, true);
  const instructionAdherenceResult = await instructionAdherenceScorer.scoreExample(example);
  results.push(instructionAdherenceResult);
  logger.info(`Score: ${instructionAdherenceResult.score}`, { exampleId });
  logger.info(`Success: ${instructionAdherenceResult.success}`, { exampleId });
  logger.info(`Reason: ${instructionAdherenceResult.reason}`, { exampleId });
  
  return results;
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
    const results = await runAllScorers(testExample, judge, SUCCESS_THRESHOLD, true);
    
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
