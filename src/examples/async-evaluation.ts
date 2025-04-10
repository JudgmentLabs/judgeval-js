/**
 * Async Evaluation Example
 * 
 * This example demonstrates how to use async evaluation with progress tracking.
 * It shows the complete workflow of:
 * 1. Submitting an async evaluation
 * 2. Tracking the progress of the evaluation
 * 3. Retrieving and displaying the results
 */

import * as dotenv from 'dotenv';
import { Example } from '../data/example';
import { JudgmentClient } from '../judgment-client';
import { 
  FaithfulnessScorer,
  AnswerCorrectnessScorer
} from '../scorers/api-scorer';
import { v4 as uuidv4 } from 'uuid';
import { Tracer } from '../common/tracer';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Create a unique ID for this run to avoid conflicts
    const runId = Date.now();
    const projectName = 'typescript-sdk-async-test';
    const evalName = `async-eval-${runId}`;
    
    console.log('Starting async evaluation example...');
    console.log('Initializing JudgmentClient...');
    
    // Initialize the JudgmentClient
    const client = JudgmentClient.getInstance();
    
    // Initialize the Tracer with API key and organization ID from environment variables
    const tracer = Tracer.getInstance({
      projectName: projectName,
      enableMonitoring: true,
      enableEvaluations: true,
      apiKey: process.env.JUDGMENT_API_KEY,
      organizationId: process.env.JUDGMENT_ORG_ID
    });
    
    // Create simple examples for evaluation
    console.log('Creating examples...');
    const examples = [
      new Example({
        input: "What is the capital of France?",
        actualOutput: "The capital of France is Paris, which is known as the City of Light.",
        expectedOutput: "Paris is the capital of France."
      }),
      new Example({
        input: "How many planets are in our solar system?",
        actualOutput: "There are eight planets in our solar system: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune. Pluto was reclassified as a dwarf planet in 2006.",
        expectedOutput: "There are eight planets in our solar system."
      })
    ];
    console.log(`Created ${examples.length} examples`);
    
    // Create scorers
    console.log('Creating scorers...');
    const scorers = [
      new FaithfulnessScorer(0.7),
      new AnswerCorrectnessScorer(0.6)
    ];
    console.log(`Created ${scorers.length} scorers`);
    
    console.log(`Project: ${projectName}`);
    console.log(`Evaluation run: ${evalName}`);
    
    // Run the async evaluation within a trace
    await tracer.runInTrace(
      {
        name: 'async-evaluation-trace',
        projectName: projectName,
        overwrite: true,
        createRootSpan: true
      },
      async (traceClient) => {
        console.log(`Trace ID: ${traceClient.traceId}`);
        console.log(`Trace Name: ${traceClient.name}`);
        
        console.log('\n=== Starting Async Evaluation Workflow ===');
        console.log('Starting async evaluation...');
        console.log('Input parameters:');
        console.log(`- Examples: ${examples.length}`);
        console.log(`- Scorers: ${scorers.map(s => s.constructor.name).join(', ')}`);
        console.log(`- Project: ${projectName}`);
        console.log(`- Evaluation run: ${evalName}`);
        
        // Record the initial state in the trace
        await traceClient.runInSpan(
          'initialize_evaluation',
          { spanType: 'evaluation' },
          async () => {
            // Record inputs manually
            traceClient.recordInput({
              examples: examples.length,
              scorers: scorers.map(s => s.constructor.name),
              projectName,
              evalName,
              timestamp: new Date().toISOString(),
              status: 'starting'
            });
            
            console.log('Submitting async evaluation job...');
            
            try {
              // For this example, we'll simulate the async evaluation process
              console.log('\nSimulating async evaluation submission...');
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Record the successful submission
              traceClient.recordOutput({
                status: 'submitted',
                timestamp: new Date().toISOString()
              });
              
              console.log('\nAsync evaluation job submitted successfully!');
              console.log('\n=== Monitoring Evaluation Progress ===');
              
              // Simulate the async evaluation process with progress updates
              const totalSteps = 10;
              let lastProgress = 0;
              
              for (let step = 1; step <= totalSteps; step++) {
                const progress = step / totalSteps;
                
                // Record the progress in the trace
                await traceClient.runInSpan(
                  `progress_update_${step}`,
                  { spanType: 'evaluation' },
                  async () => {
                    // Record inputs manually
                    traceClient.recordInput({
                      progress: Math.round(progress * 100),
                      status: progress < 1 ? 'in_progress' : 'complete',
                      step,
                      totalSteps,
                      timestamp: new Date().toISOString()
                    });
                    
                    // In a real scenario, you would check the status like this:
                    // const status = await client.checkEvalStatus(projectName, evalName);
                    // const progress = status.progress || 0;
                    
                    // Only show progress updates when the progress changes
                    if (Math.round(progress * 100) !== lastProgress) {
                      lastProgress = Math.round(progress * 100);
                      const progressBar = createProgressBar(progress);
                      console.log(`Progress: ${progressBar} ${lastProgress}%`);
                    }
                    
                    // Record the output with the current progress
                    traceClient.recordOutput({
                      progress: Math.round(progress * 100),
                      status: progress < 1 ? 'in_progress' : 'complete',
                      timestamp: new Date().toISOString()
                    });
                  }
                );
                
                // Wait before the next check
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
              
              console.log('\nEvaluation complete! Fetching results...');
              
              // Generate mock results for demonstration
              const results = [
                {
                  dataObject: {
                    input: "What is the capital of France?",
                    actualOutput: "The capital of France is Paris, which is known as the City of Light.",
                    expectedOutput: "Paris is the capital of France."
                  },
                  scorersData: [
                    { name: "FaithfulnessScorer", score: 0.95 },
                    { name: "AnswerCorrectnessScorer", score: 0.98 }
                  ]
                },
                {
                  dataObject: {
                    input: "How many planets are in our solar system?",
                    actualOutput: "There are eight planets in our solar system: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune. Pluto was reclassified as a dwarf planet in 2006.",
                    expectedOutput: "There are eight planets in our solar system."
                  },
                  scorersData: [
                    { name: "FaithfulnessScorer", score: 0.92 },
                    { name: "AnswerCorrectnessScorer", score: 0.89 }
                  ]
                }
              ];
              
              // Record the final results in the trace
              await traceClient.runInSpan(
                'evaluation_results',
                { spanType: 'evaluation' },
                async () => {
                  // Record inputs manually
                  traceClient.recordInput({
                    results,
                    status: 'complete',
                    progress: 100,
                    timestamp: new Date().toISOString(),
                    completedAt: new Date().toISOString()
                  });
                  
                  console.log(`\n=== Evaluation Results (${results.length} examples) ===`);
                  
                  // Process and display results
                  if (results.length > 0) {
                    results.forEach((result, index) => {
                      console.log(`\nExample ${index + 1}:`);
                      console.log(`Input: "${result.dataObject?.input?.substring(0, 30)}..."`);
                      
                      if (result.scorersData) {
                        console.log("Scores:");
                        result.scorersData.forEach(sd => {
                          console.log(`  ${sd.name}: ${sd.score.toFixed(2)}`);
                        });
                      }
                    });
                    
                    // Calculate and display average scores
                    const scorerTotals: Record<string, { total: number, count: number }> = {};
                    
                    results.forEach(result => {
                      if (result.scorersData) {
                        result.scorersData.forEach(sd => {
                          const name = sd.name || 'Unknown';
                          if (!scorerTotals[name]) {
                            scorerTotals[name] = { total: 0, count: 0 };
                          }
                          scorerTotals[name].total += sd.score;
                          scorerTotals[name].count += 1;
                        });
                      }
                    });
                    
                    console.log('\nAverage Scores:');
                    Object.entries(scorerTotals).forEach(([name, data]) => {
                      const average = data.total / data.count;
                      console.log(`  ${name}: ${average.toFixed(2)}`);
                    });
                  }
                  
                  // Record the final output with the results
                  traceClient.recordOutput({
                    results,
                    status: 'complete',
                    progress: 100,
                    timestamp: new Date().toISOString(),
                    completedAt: new Date().toISOString(),
                    token_counts: {
                      prompt_tokens: 0,
                      completion_tokens: 0,
                      total_tokens: 0,
                      prompt_tokens_cost_usd: 0,
                      completion_tokens_cost_usd: 0,
                      total_cost_usd: 0
                    }
                  });
                }
              );
              
              // Save the trace explicitly to ensure it's properly saved
              await traceClient.save(false);
              
              console.log('\n=== Async Evaluation Complete ===');
              console.log(`View detailed results at: https://app.judgmentlabs.ai/app/experiment?project_name=${projectName}&eval_run_name=${evalName}`);
              console.log(`View trace details at: https://app.judgmentlabs.ai/app/monitor?project_name=${projectName}&trace_id=${traceClient.traceId}`);
              
              console.log('\n=== How Async Evaluation Works ===');
              console.log('1. Submit async evaluation with client.aRunEvaluation() or client.evaluate({asyncExecution: true})');
              console.log('2. Check status with client.checkEvalStatus(projectName, evalName)');
              console.log('3. Poll for completion with client.waitForEvaluation(projectName, evalName, options)');
              console.log('4. Process results when complete');
              
              // For a real async evaluation, you would use one of these methods:
              
              // Method 1: Use aRunEvaluation (recommended for async)
              await client.aRunEvaluation(
                examples,
                scorers,
                "gpt-4o-mini", // Use a valid model name
                undefined, // aggregator
                { 
                  timestamp: runId, 
                  traceId: traceClient.traceId 
                }, // metadata
                true, // logResults
                projectName,
                evalName,
                true, // override
                true, // useJudgment
                true // ignoreErrors
              );
              
              // Method 2: Use evaluate with asyncExecution
              // await client.evaluate({
              //   examples,
              //   scorers,
              //   model: "gpt-4o-mini", // Use a valid model name
              //   projectName,
              //   evalName,
              //   logResults: true,
              //   useJudgment: true,
              //   ignoreErrors: true,
              //   asyncExecution: true,
              //   override: true,
              //   metadata: { 
              //     traceId: traceClient.traceId,
              //     timestamp: new Date().toISOString()
              //   }
              // });
              
            } catch (error) {
              console.error(`Error submitting or monitoring async evaluation: ${error instanceof Error ? error.message : String(error)}`);
              
              // Record the error in the trace
              traceClient.recordOutput({
                error: error instanceof Error ? error.message : String(error),
                status: 'error',
                timestamp: new Date().toISOString()
              });
            }
          }
        );
      }
    );
    
  } catch (error) {
    console.error(`Error in async evaluation: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function to create a simple ASCII progress bar
function createProgressBar(percent: number, length: number = 30): string {
  const filled = Math.round(percent * length);
  const empty = length - filled;
  return `[${'='.repeat(filled)}${' '.repeat(empty)}]`;
}

// Run the example
main().catch(error => {
  console.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
});
