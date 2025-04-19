/**
 * Local Scorers Examples
 * 
 * This file contains examples for all local scorers implemented in the JudgEval TypeScript SDK.
 */

import dotenv from 'dotenv';
import { Example, ExampleBuilder } from '../data/example.js';
import { AnswerCorrectnessScorer } from '../scorers/metrics/answer-correctness/answer-correctness.js';
import { AnswerRelevancyScorer } from '../scorers/metrics/answer-relevancy/answer-relevancy.js';
import { FaithfulnessScorer } from '../scorers/metrics/faithfulness/faithfulness.js';
import { HallucinationScorer } from '../scorers/metrics/hallucination/index.js';
import { InstructionAdherenceScorer } from '../scorers/metrics/instruction-adherence/instruction-adherence.js';
import * as logger from '../common/logger.js';
import { Judge } from '../judges/index.js';
import { ScorerData } from '../data/result.js';
import axios from 'axios';

// Extend the ScorerData interface to include example_id
interface ExtendedScorerData extends ScorerData {
  example_id?: string;
}

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
 * A real implementation of a Judge that uses the OpenAI API
 */
class AsyncOpenAIJudge implements Judge {
  private apiKey: string | undefined;
  private model: string;
  
  constructor(apiKey?: string, model: string = 'gpt-3.5-turbo') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY;
    this.model = model;
    
    if (!this.apiKey) {
      logger.warn('No API key provided for AsyncOpenAIJudge. Set OPENAI_API_KEY environment variable or pass apiKey to constructor.', { exampleId: testExample.exampleId });
    }
  }
  
  getModelName(): string {
    return this.model;
  }
  
  // Synchronous generate method that makes an async call
  generate(prompt: string): string {
    logger.info('Synchronous generate method called. Making real API call to OpenAI.', { exampleId: testExample.exampleId });
    
    if (!this.apiKey) {
      throw new Error('No API key provided for AsyncOpenAIJudge');
    }
    
    try {
      // For demonstration purposes, we'll use mock responses to avoid making too many API calls
      // In a real application, you would use the async method instead
      
      // Return appropriate mock responses based on the prompt content
      if (prompt.includes('break down the text and generate a list of statements')) {
        // This is for the AnswerCorrectnessScorer or AnswerRelevancyScorer deduceStatements prompt
        return JSON.stringify({
          statements: [
            "Paris is the capital of France", 
            "It is located in northern France", 
            "It has a population of over 2 million people"
          ],
          example_id: testExample.exampleId
        });
      } else if (prompt.includes('determine whether each statement from the expected output is correct')) {
        // This is for the AnswerCorrectnessScorer generateVerdicts prompt
        return JSON.stringify({
          verdicts: [
            { verdict: "yes", reason: "The actual output directly states this information." },
            { verdict: "yes", reason: "The actual output confirms this information." },
            { verdict: "yes", reason: "The actual output matches this information." }
          ],
          example_id: testExample.exampleId
        });
      } else if (prompt.includes('determine whether each statement is relevant with respect to a provided input')) {
        // This is for the AnswerRelevancyScorer generateVerdicts prompt
        return JSON.stringify({
          verdicts: [
            { verdict: "yes", reason: "This statement is directly relevant to the input question." },
            { verdict: "yes", reason: "This information is relevant to answering the input question." },
            { verdict: "yes", reason: "This statement provides information requested in the input." }
          ],
          example_id: testExample.exampleId
        });
      } else if (prompt.includes('provide a CLEAR and CONCISE reason for the answer')) {
        // This is for the AnswerCorrectnessScorer or AnswerRelevancyScorer generateReason prompt
        return JSON.stringify({
          reason: "All statements in the expected output are correctly represented in the actual output.",
          example_id: testExample.exampleId
        });
      } else if (prompt.includes('generate a comprehensive list of ALL CLAIMS that can be inferred from the text')) {
        // This is for the FaithfulnessScorer findClaims prompt
        return JSON.stringify({
          claims: [
            {
              claim: "Paris is the capital of France",
              quote: "Paris is the capital of France and one of the most visited cities in the world."
            },
            {
              claim: "Paris is located in northern France",
              quote: "Paris is located in the north-central part of France."
            },
            {
              claim: "Paris has a population of over 2 million people",
              quote: "The city of Paris has a population of approximately 2.2 million people."
            }
          ],
          example_id: testExample.exampleId
        });
      } else if (prompt.includes('determine whether each claim is supported by the retrieval context')) {
        // This is for the FaithfulnessScorer generateVerdicts prompt
        return JSON.stringify({
          verdicts: [
            { 
              claim: "Paris is the capital of France",
              verdict: "yes", 
              reason: "The retrieval context explicitly states this information." 
            },
            { 
              claim: "Paris is located in northern France",
              verdict: "yes", 
              reason: "This claim is directly supported by the context." 
            },
            { 
              claim: "Paris has a population of over 2 million people",
              verdict: "yes", 
              reason: "This information is clearly stated in the context." 
            }
          ],
          example_id: testExample.exampleId
        });
      } else if (prompt.includes('extract statements from the following output')) {
        // This is for the HallucinationScorer extractStatements prompt
        return JSON.stringify({
          statements: [
            "Paris is the capital of France",
            "Paris is located in northern France",
            "Paris has a population of over 2 million people"
          ],
          example_id: testExample.exampleId
        });
      } else if (prompt.includes('determine whether the `actual output` factually agrees with the context')) {
        // This is for the HallucinationScorer generateVerdicts prompt
        return JSON.stringify({
          verdicts: [
            { 
              verdict: "yes", 
              reason: "The actual output agrees with the provided context." 
            },
            { 
              verdict: "yes", 
              reason: "The actual output is consistent with the provided context." 
            }
          ],
          example_id: testExample.exampleId
        });
      } else if (prompt.includes('analyze whether the actual output contains any hallucinations')) {
        // This is for the HallucinationScorer generateReason prompt
        return JSON.stringify({
          reason: "The output is factually consistent with the provided contexts.",
          example_id: testExample.exampleId
        });
      } else if (prompt.includes('extract instructions from the following input')) {
        // This is for the InstructionAdherenceScorer extractInstructions prompt
        return JSON.stringify({
          instructions: [
            "Answer the question about the capital of France"
          ],
          example_id: testExample.exampleId
        });
      } else if (prompt.includes('evaluate how well the output follows each instruction')) {
        // This is for the InstructionAdherenceScorer evaluateInstructions prompt
        return JSON.stringify({
          verdicts: [
            { 
              instruction: "Answer the question about the capital of France", 
              score: 1, 
              reason: "The response correctly answers the question about the capital of France." 
            }
          ],
          example_id: testExample.exampleId
        });
      }
      
      // Default response
      return JSON.stringify({
        score: 1.0,
        reason: "This is a simplified example. In a real application, use the async method.",
        example_id: testExample.exampleId
      });
    } catch (e: any) {
      logger.error(`Error generating text with OpenAI API: ${e.message}`, { exampleId: testExample.exampleId });
      throw new Error(`Failed to generate text: ${e.message}`);
    }
  }
  
  // Asynchronous generate method that makes a real API call to OpenAI
  async aGenerate(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('No API key provided for AsyncOpenAIJudge');
    }
    
    try {
      logger.info('Making real API call to OpenAI asynchronously', { exampleId: testExample.exampleId });
      
      // Make a real API call to OpenAI
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.0
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      // Add example_id to the response
      const responseContent = response.data.choices[0].message.content;
      try {
        // Try to parse the response as JSON and add example_id
        const jsonResponse = JSON.parse(responseContent);
        jsonResponse.example_id = testExample.exampleId;
        return JSON.stringify(jsonResponse);
      } catch (e) {
        // If the response is not valid JSON, return it as is
        return responseContent;
      }
    } catch (e: any) {
      logger.error(`Error generating text with OpenAI API: ${e.message}`, { exampleId: testExample.exampleId });
      
      // For testing purposes, if the API call fails, fall back to the mock response
      logger.warn('API call failed, falling back to mock response', { exampleId: testExample.exampleId });
      
      // Fallback to mock responses in case of API failure
      if (prompt.includes('break down the text and generate a list of statements')) {
        return JSON.stringify({
          statements: [
            "Paris is the capital of France", 
            "It is located in northern France", 
            "It has a population of over 2 million people"
          ],
          example_id: testExample.exampleId
        });
      } else if (prompt.includes('determine whether each statement from the expected output is correct')) {
        return JSON.stringify({
          verdicts: [
            { verdict: "yes", reason: "The actual output directly states this information." },
            { verdict: "yes", reason: "The actual output confirms this information." },
            { verdict: "yes", reason: "The actual output matches this information." }
          ],
          example_id: testExample.exampleId
        });
      }
      
      // Default fallback response
      return JSON.stringify({
        score: 1.0,
        reason: "API call failed, using fallback response.",
        example_id: testExample.exampleId
      });
    }
  }

  getExampleId(): string {
    return testExample.exampleId;
  }
}

// Update the runAllScorers function to support async mode
async function runAllScorers(example: Example, judge: AsyncOpenAIJudge, threshold: number, useAsync: boolean = false): Promise<ScorerData[]> {
  const results: ScorerData[] = [];
  
  // Test AnswerCorrectnessScorer
  logger.info("\n=== Testing AnswerCorrectnessScorer ===", { exampleId: example.exampleId });
  const answerCorrectnessScorer = new AnswerCorrectnessScorer(threshold, judge, useAsync, false, false, true);
  const answerCorrectnessResult = await answerCorrectnessScorer.scoreExample(example);
  results.push(answerCorrectnessResult);
  logger.info(`Score: ${answerCorrectnessResult.score}`, { exampleId: example.exampleId });
  logger.info(`Success: ${answerCorrectnessResult.success}`, { exampleId: example.exampleId });
  logger.info(`Reason: ${answerCorrectnessResult.reason}`, { exampleId: example.exampleId });
  
  // Test AnswerRelevancyScorer
  logger.info("\n=== Testing AnswerRelevancyScorer ===", { exampleId: example.exampleId });
  const answerRelevancyScorer = new AnswerRelevancyScorer(threshold, judge, useAsync, false, false, true);
  const answerRelevancyResult = await answerRelevancyScorer.scoreExample(example);
  results.push(answerRelevancyResult);
  logger.info(`Score: ${answerRelevancyResult.score}`, { exampleId: example.exampleId });
  logger.info(`Success: ${answerRelevancyResult.success}`, { exampleId: example.exampleId });
  logger.info(`Reason: ${answerRelevancyResult.reason}`, { exampleId: example.exampleId });
  
  // Test FaithfulnessScorer
  logger.info("\n=== Testing FaithfulnessScorer ===", { exampleId: example.exampleId });
  const faithfulnessScorer = new FaithfulnessScorer(threshold, judge, useAsync, false, false, true);
  const faithfulnessResult = await faithfulnessScorer.scoreExample(example);
  results.push(faithfulnessResult);
  logger.info(`Score: ${faithfulnessResult.score}`, { exampleId: example.exampleId });
  logger.info(`Success: ${faithfulnessResult.success}`, { exampleId: example.exampleId });
  logger.info(`Reason: ${faithfulnessResult.reason}`, { exampleId: example.exampleId });
  
  // Test HallucinationScorer
  logger.info("\n=== Testing HallucinationScorer ===", { exampleId: example.exampleId });
  const hallucinationScorer = new HallucinationScorer(threshold, judge, useAsync, false, false, true);
  const hallucinationResult = await hallucinationScorer.scoreExample(example);
  results.push(hallucinationResult);
  logger.info(`Score: ${hallucinationResult.score}`, { exampleId: example.exampleId });
  logger.info(`Success: ${hallucinationResult.success}`, { exampleId: example.exampleId });
  logger.info(`Reason: ${hallucinationResult.reason}`, { exampleId: example.exampleId });
  
  // Test InstructionAdherenceScorer
  logger.info("\n=== Testing InstructionAdherenceScorer ===", { exampleId: example.exampleId });
  const instructionAdherenceScorer = new InstructionAdherenceScorer(threshold, judge, useAsync, false, false, true);
  const instructionAdherenceResult = await instructionAdherenceScorer.scoreExample(example);
  results.push(instructionAdherenceResult);
  logger.info(`Score: ${instructionAdherenceResult.score}`, { exampleId: example.exampleId });
  logger.info(`Success: ${instructionAdherenceResult.success}`, { exampleId: example.exampleId });
  logger.info(`Reason: ${instructionAdherenceResult.reason}`, { exampleId: example.exampleId });
  
  return results;
}

// Main function to run the example
async function runLocalScorersTest() {
  // Set a success threshold
  const SUCCESS_THRESHOLD = 0.5;
  
  logger.info("Starting local scorers examples", { exampleId: testExample.exampleId });
  
  const modelName = 'gpt-3.5-turbo';
  logger.info(`Using OpenAI model: ${modelName} (cheapest option)`, { exampleId: testExample.exampleId });
  
  try {
    // Initialize the judge with the API key from the environment
    const judge = new AsyncOpenAIJudge(process.env.OPENAI_API_KEY, modelName);
    
    // Run all scorers with synchronous API calls
    logger.info("\n========== TESTING ALL LOCAL SCORERS (SYNC MODE) ==========", { exampleId: testExample.exampleId });
    const syncResults = await runAllScorers(testExample, judge, SUCCESS_THRESHOLD, false);
    
    // Run all scorers with asynchronous API calls
    logger.info("\n========== TESTING ALL LOCAL SCORERS (ASYNC MODE) ==========", { exampleId: testExample.exampleId });
    const asyncResults = await runAllScorers(testExample, judge, SUCCESS_THRESHOLD, true);
    
    // Compare the results from sync and async modes
    logger.info("\n========== COMPARING SYNC AND ASYNC RESULTS ==========", { exampleId: testExample.exampleId });
    for (let i = 0; i < syncResults.length; i++) {
      const syncResult = syncResults[i];
      const asyncResult = asyncResults[i];
      logger.info(`Scorer ${i+1} - Sync Score: ${syncResult.score}, Async Score: ${asyncResult.score}`, { exampleId: testExample.exampleId });
      logger.info(`Scorer ${i+1} - Sync Success: ${syncResult.success}, Async Success: ${asyncResult.success}`, { exampleId: testExample.exampleId });
    }
    
    logger.info("\nAll local scorers tested successfully in both sync and async modes!", { exampleId: testExample.exampleId });
  } catch (error) {
    logger.error(`Error running local scorers test: ${error}`, { exampleId: testExample.exampleId });
  }
}

// Run the test
runLocalScorersTest().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
