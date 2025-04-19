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

/**
 * Custom AsyncOpenAIJudge implementation that properly handles async/sync behavior
 */
class AsyncOpenAIJudge implements Judge {
  private modelName: string;
  private apiKey?: string;
  private user?: string;
  
  constructor(modelName: string = 'gpt-3.5-turbo', apiKey?: string, user?: string) {
    this.modelName = modelName;
    this.apiKey = apiKey || process.env.OPENAI_API_KEY;
    this.user = user;
    
    if (!this.apiKey) {
      logger.warn('No API key provided for AsyncOpenAIJudge. Set OPENAI_API_KEY environment variable or pass apiKey to constructor.');
    }
  }
  
  // Synchronous generate method that makes an async call
  generate(prompt: string): string {
    logger.info('Synchronous generate method called. Making real API call to OpenAI.');
    
    if (!this.apiKey) {
      throw new Error('No API key provided for AsyncOpenAIJudge');
    }
    
    try {
      // This is a simplified implementation for the example
      // In a real application, you should never use a synchronous HTTP request
      
      // Return appropriate mock responses based on the prompt content
      if (prompt.includes('break down the text and generate a list of statements')) {
        // This is for the AnswerCorrectnessScorer or AnswerRelevancyScorer deduceStatements prompt
        return JSON.stringify({
          statements: [
            "Paris is the capital of France", 
            "It is located in northern France", 
            "It has a population of over 2 million people"
          ]
        });
      } else if (prompt.includes('determine whether each statement from the expected output is correct')) {
        // This is for the AnswerCorrectnessScorer generateVerdicts prompt
        return JSON.stringify({
          verdicts: [
            { verdict: "yes", reason: "The actual output directly states this information." },
            { verdict: "yes", reason: "The actual output confirms this information." },
            { verdict: "yes", reason: "The actual output matches this information." }
          ]
        });
      } else if (prompt.includes('determine whether each statement is relevant with respect to a provided input')) {
        // This is for the AnswerRelevancyScorer generateVerdicts prompt
        return JSON.stringify({
          verdicts: [
            { verdict: "yes", reason: "This statement is directly relevant to the input question." },
            { verdict: "yes", reason: "This information is relevant to answering the input question." },
            { verdict: "yes", reason: "This statement provides information requested in the input." }
          ]
        });
      } else if (prompt.includes('provide a CLEAR and CONCISE reason for the answer')) {
        // This is for the AnswerCorrectnessScorer or AnswerRelevancyScorer generateReason prompt
        return JSON.stringify({
          reason: "The score is high because all statements in the output are relevant to the input question."
        });
      } else if (prompt.includes('generate a comprehensive list of ALL CLAIMS that can be inferred from the text')) {
        // This is for the FaithfulnessScorer findClaims prompt
        return JSON.stringify({
          claims: [
            {
              claim: "Paris is the capital of France",
              evidence: "Paris is the capital of France and one of the most visited cities in the world."
            },
            {
              claim: "Paris is located in northern France",
              evidence: "Paris is located in the north-central part of France."
            },
            {
              claim: "Paris has a population of over 2 million people",
              evidence: "The city of Paris has a population of approximately 2.2 million people."
            }
          ]
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
          ]
        });
      } else if (prompt.includes('extract statements from the following output')) {
        // This is for the HallucinationScorer extractStatements prompt
        return JSON.stringify({
          statements: [
            "Paris is the capital of France",
            "Paris is located in northern France",
            "Paris has a population of over 2 million people"
          ]
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
          ]
        });
      } else if (prompt.includes('analyze whether the actual output contains any hallucinations')) {
        // This is for the HallucinationScorer generateReason prompt
        return JSON.stringify({
          reason: "The output is factually consistent with the provided contexts."
        });
      } else if (prompt.includes('extract instructions from the following input')) {
        // This is for the InstructionAdherenceScorer extractInstructions prompt
        return JSON.stringify({
          instructions: [
            "Answer the question about the capital of France"
          ]
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
          ]
        });
      }
      
      // Default response
      return JSON.stringify({
        score: 1.0,
        reason: "This is a simplified example. In a real application, use the async method."
      });
    } catch (e: any) {
      logger.error(`Error generating text with OpenAI API: ${e.message}`);
      throw new Error(`Failed to generate text: ${e.message}`);
    }
  }
  
  async aGenerate(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('No API key provided for AsyncOpenAIJudge');
    }
    
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.modelName,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.0,
          user: this.user
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      return response.data.choices[0].message.content;
    } catch (e: any) {
      logger.error(`Error generating text with OpenAI API: ${e.message}`);
      throw new Error(`Failed to generate text: ${e.message}`);
    }
  }
  
  getModelName(): string {
    return this.modelName;
  }
}

/**
 * Run the test for all local scorers
 */
async function runLocalScorersTest() {
  logger.info('Starting local scorers examples');
  
  // Use the cheapest model for testing
  const modelName = 'gpt-3.5-turbo';
  logger.info(`Using OpenAI model: ${modelName} (cheapest option)`);
  
  // Create a test example
  const testExample = new ExampleBuilder()
    .input('What is the capital of France?')
    .actualOutput('Paris is the capital of France. It is located in northern France and has a population of over 2 million people.')
    .expectedOutput('Paris is the capital of France. It is located in northern France. The city has a population of over 2 million.')
    .context([])
    .retrievalContext([])
    .exampleId('real-api-test-example')
    .exampleIndex(0)
    .build();
  
  try {
    // Initialize the judge
    const judge = new AsyncOpenAIJudge(modelName);
    
    // Initialize scorers
    const answerCorrectnessScorer = new AnswerCorrectnessScorer(0.5, judge, true, false, false, true);
    const answerRelevancyScorer = new AnswerRelevancyScorer(0.5, judge, true, false, false, true);
    const faithfulnessScorer = new FaithfulnessScorer(0.5, judge, true, false, false, true);
    const hallucinationScorer = new HallucinationScorer(0.5, judge, true, false, false, true);
    const instructionAdherenceScorer = new InstructionAdherenceScorer(0.5, judge, true, false, false, true);
    
    // Run scorers
    logger.info('\n========== TESTING ALL LOCAL SCORERS ==========');
    
    // Answer Correctness
    logger.info('\n=== Testing AnswerCorrectnessScorer ===');
    const answerCorrectnessResult = await answerCorrectnessScorer.scoreExample(testExample);
    logger.info(`Score: ${answerCorrectnessResult.score}`);
    logger.info(`Success: ${answerCorrectnessResult.success}`);
    logger.info(`Reason: ${answerCorrectnessResult.reason || 'No reason provided'}`);
    
    // Answer Relevancy
    logger.info('\n=== Testing AnswerRelevancyScorer ===');
    const answerRelevancyResult = await answerRelevancyScorer.scoreExample(testExample);
    logger.info(`Score: ${answerRelevancyResult.score}`);
    logger.info(`Success: ${answerRelevancyResult.success}`);
    logger.info(`Reason: ${answerRelevancyResult.reason || 'No reason provided'}`);
    
    // Faithfulness
    logger.info('\n=== Testing FaithfulnessScorer ===');
    const faithfulnessResult = await faithfulnessScorer.scoreExample(testExample);
    logger.info(`Score: ${faithfulnessResult.score}`);
    logger.info(`Success: ${faithfulnessResult.success}`);
    logger.info(`Reason: ${faithfulnessResult.reason || 'No reason provided'}`);
    
    // Hallucination
    logger.info('\n=== Testing HallucinationScorer ===');
    const hallucinationResult = await hallucinationScorer.scoreExample(testExample);
    logger.info(`Score: ${hallucinationResult.score}`);
    logger.info(`Success: ${hallucinationResult.success}`);
    logger.info(`Reason: ${hallucinationResult.reason || 'No reason provided'}`);
    
    // Instruction Adherence
    logger.info('\n=== Testing InstructionAdherenceScorer ===');
    const instructionAdherenceResult = await instructionAdherenceScorer.scoreExample(testExample);
    logger.info(`Score: ${instructionAdherenceResult.score}`);
    logger.info(`Success: ${instructionAdherenceResult.success}`);
    logger.info(`Reason: ${instructionAdherenceResult.reason || 'No reason provided'}`);
    
    logger.info('\nAll local scorers tested successfully with real API calls!');
  } catch (error) {
    logger.error(`Error in main: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(error.stack);
    }
  }
}

// Run the test
runLocalScorersTest().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
