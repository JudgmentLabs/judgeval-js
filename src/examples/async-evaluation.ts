import * as dotenv from 'dotenv';
import { Example } from '../data/example';
import { JudgmentClient } from '../judgment-client';
import { 
  FaithfulnessScorer, 
  AnswerCorrectnessScorer,
  HallucinationScorer,
  ContextualRelevancyScorer
} from '../scorers/api-scorer';
import logger from '../common/logger';

// Load environment variables
dotenv.config();

/**
 * This example demonstrates how to use async evaluation in the TypeScript SDK.
 * Async evaluation allows you to submit evaluation jobs to be processed in the background,
 * which is useful for large-scale evaluations that might take a long time to complete.
 */
async function main() {
  try {
    logger.enableLogging('async-eval-example', './logs');
    logger.info('Starting async evaluation example...');

    // Initialize the JudgmentClient
    const judgmentClient = JudgmentClient.getInstance();
    
    // --- Create examples with context for more comprehensive evaluation ---
    const examples = [
      new Example({
        input: 'Based on the context, what is the capital of France?',
        actualOutput: 'According to the context, the capital of France is Paris, which is located on the Seine River.',
        context: [
          'France is a country in Western Europe.',
          'Paris is the capital and most populous city of France.',
          'Paris is situated on the Seine River, in the north of the country.'
        ]
      }),
      new Example({
        input: 'What is the tallest mountain in the world according to the context?',
        actualOutput: 'Based on the context, Mount Everest is the tallest mountain in the world, with a height of 8,848 meters.',
        context: [
          'Mount Everest is Earth\'s highest mountain above sea level, located in the Mahalangur Himal sub-range of the Himalayas.',
          'Its elevation of 8,848 meters was most recently established in 2020 by the Nepali and Chinese authorities.',
          'K2 is the second-highest mountain on Earth, with a peak elevation of 8,611 meters.'
        ]
      }),
      new Example({
        input: 'Summarize the key points about climate change from the context.',
        actualOutput: 'Climate change is primarily caused by human activities, especially the burning of fossil fuels. It leads to global warming, rising sea levels, and more extreme weather events. Mitigation efforts include reducing carbon emissions and transitioning to renewable energy sources.',
        context: [
          'Climate change refers to long-term shifts in temperatures and weather patterns.',
          'Human activities have been the main driver of climate change since the 1800s, primarily due to the burning of fossil fuels like coal, oil, and gas.',
          'The effects of climate change include global warming, rising sea levels, melting ice caps, and more frequent extreme weather events.',
          'Mitigation strategies include reducing carbon emissions, improving energy efficiency, and transitioning to renewable energy sources.'
        ]
      })
    ];

    // --- Create multiple scorers to evaluate different aspects of the responses ---
    const scorers = [
      new FaithfulnessScorer(0.7),
      new AnswerCorrectnessScorer(0.5),
      new HallucinationScorer(0.3),
      new ContextualRelevancyScorer(0.6)
    ];

    // --- Run the evaluation asynchronously ---
    logger.info('Starting async evaluation...');
    
    // Enable logging for this example
    logger.enableLogging('async-eval-example', './logs');
    
    try {
      // Use the simplified evaluate method with asyncExecution: true
      const projectName = 'typescript-sdk-async-test';
      const evalRunName = `async-evaluation-${Date.now()}`;
      await judgmentClient.evaluate({
        examples: examples,
        scorers: scorers,
        projectName: projectName,
        evalName: evalRunName,
        model: 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo',
        asyncExecution: true
      });
      
      logger.info(`Async evaluation started. You can check the status at https://app.judgmentlabs.ai/app/experiment?project_name=${projectName}&eval_run_name=${evalRunName}`);
      
      // --- Check the status of the evaluation ---
      logger.info('Checking evaluation status...');
      let status = await judgmentClient.checkEvalStatus(projectName, evalRunName);
      logger.info(`Current status: ${status.status}`);
      
      // Wait for the evaluation to complete (in a real application, you might want to implement polling)
      if (status.status !== 'COMPLETED') {
        logger.info('Waiting for evaluation to complete...');
        
        // Simple polling mechanism (not recommended for production)
        let attempts = 0;
        const maxAttempts = 10;
        
        while (status.status !== 'COMPLETED' && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          status = await judgmentClient.checkEvalStatus(projectName, evalRunName);
          logger.info(`Current status: ${status.status}`);
          attempts++;
        }
      }
      
      // --- Pull the results when the evaluation is complete ---
      if (status.status === 'COMPLETED') {
        logger.info('Evaluation completed. Pulling results...');
        const results = await judgmentClient.pullEvalResults(projectName, evalRunName);
        
        // Use the new printResults function to display results in Python SDK format
        logger.printResults(results, projectName, evalRunName);
        
        logger.info(`Evaluation completed with ${results.length} results`);
      } else {
        logger.info('Evaluation did not complete in the expected time. Please check the status later.');
      }
    } catch (error) {
      logger.error(`Error in async evaluation: ${error}`);
    }
  } catch (error) {
    logger.error(`Error in async evaluation example: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the example
main().catch(error => {
  logger.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
});
