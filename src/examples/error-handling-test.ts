import dotenv from 'dotenv';
import { Example } from '../data/example';
import { EvaluationRun } from '../evaluation-run';
import { runEval } from '../run-evaluation';
import { AnswerCorrectnessScorer } from '../scorers/api-scorer';

// Load environment variables
dotenv.config();

/**
 * This example demonstrates the improved error handling in the TypeScript SDK.
 * It runs a basic evaluation and shows how errors are properly handled and reported.
 */
async function main() {
  try {
    console.log('Starting error handling test...');

    // Get API key from environment variables
    const apiKey = process.env.JUDGMENT_API_KEY;
    const organizationId = process.env.ORGANIZATION_ID;

    if (!apiKey) {
      throw new Error('JUDGMENT_API_KEY environment variable is not set');
    }

    if (!organizationId) {
      throw new Error('ORGANIZATION_ID environment variable is not set');
    }

    // Create examples
    const examples = [
      new Example({
        input: 'What is the capital of France?',
        actualOutput: 'The capital of France is Paris.',
        expectedOutput: 'Paris'
      }),
      new Example({
        input: 'What is the capital of Germany?',
        actualOutput: 'Berlin is the capital of Germany.',
        expectedOutput: 'Berlin'
      })
    ];

    // Create scorers - use a concrete implementation instead of the abstract class
    const scorers = [
      new AnswerCorrectnessScorer(0.7)
    ];

    // Create evaluation run
    const evaluationRun = new EvaluationRun({
      projectName: 'typescript-sdk-test',
      evalName: `error-handling-test-${new Date().toISOString().replace(/[:.]/g, '-')}`,
      examples,
      scorers,
      model: 'gpt-4',
      judgmentApiKey: apiKey,
      organizationId: organizationId,
      logResults: true
    });

    console.log('Running evaluation...');
    
    // Run evaluation
    const results = await runEval(evaluationRun);
    
    console.log('Evaluation completed successfully!');
    console.log(`Results: ${results.length} scoring results`);
    
    // Display results
    results.forEach((result, index) => {
      console.log(`\nExample ${index + 1}:`);
      console.log(`Input: ${result.dataObject.input}`);
      console.log(`Actual output: ${result.dataObject.actualOutput}`);
      
      if (result.scorersData && result.scorersData.length > 0) {
        console.log('\nScorer results:');
        result.scorersData.forEach(scorerData => {
          console.log(`- ${scorerData.name}: ${scorerData.score.toFixed(2)} (threshold: ${scorerData.threshold.toFixed(2)}) - ${scorerData.success ? 'PASS' : 'FAIL'}`);
        });
      } else {
        console.log('\nNo scorer data available');
      }
      
      if (result.error) {
        console.log(`\nError: ${result.error}`);
      }
    });

  } catch (error) {
    console.error('Error in error handling test:', error);
  }
}

// Run the example
main().catch(error => {
  console.error('Unhandled error:', error);
});
