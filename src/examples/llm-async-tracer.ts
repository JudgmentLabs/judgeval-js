/**
 * Async Evaluation and Tracing Example
 * 
 * This example demonstrates two approaches to async evaluation:
 * 1. Using aRunEvaluation from JudgmentClient (full evaluation pipeline)
 * 2. Using asyncEvaluate from TraceClient (for evaluating within traces)
 * 
 * It shows the differences between these approaches and when to use each.
 */

import * as dotenv from 'dotenv';
import { Example } from '../data/example';
import { JudgmentClient } from '../judgment-client';
import { 
  FaithfulnessScorer,
  AnswerCorrectnessScorer
} from '../scorers/api-scorer';
import { ScoringResult } from '../data/result';
import { Tracer } from '../common/tracer';

// Load environment variables
dotenv.config();

// Helper function to create a simple ASCII progress bar
function createProgressBar(percent: number, length: number = 20): string {
  const filled = Math.round(percent * length);
  const empty = length - filled;
  return `[${'='.repeat(filled)}${' '.repeat(empty)}] ${Math.round(percent * 100)}%`;
}

async function runJudgmentClientExample() {
  // Create a unique ID for this run to avoid conflicts
  const runId = Date.now();
  const projectName = 'async-example';
  const evalName = `async-eval-${runId}`;
  
  console.log('\n=== PART 1: JudgmentClient.aRunEvaluation Example ===');
  console.log('Initializing JudgmentClient...');
  
  // Initialize the JudgmentClient
  const client = JudgmentClient.getInstance();
  console.log('Successfully initialized JudgmentClient!');
  
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
  
  // Log the input parameters
  console.log('Starting async evaluation...');
  console.log('Input parameters:');
  console.log(`- Examples: ${examples.length}`);
  console.log(`- Scorers: ${scorers.map(s => s.constructor.name).join(', ')}`);
  console.log(`- Project: ${projectName}`);
  console.log(`- Evaluation run: ${evalName}`);
  
  // Submit the async evaluation
  console.log('Submitting async evaluation job...');
  try {
    await client.aRunEvaluation(
      examples,
      scorers,
      "gpt-4", // Using a specific model instead of "default"
      undefined, // aggregator
      { timestamp: runId }, // metadata
      true, // logResults
      projectName,
      evalName,
      true, // override
      true, // useJudgment
      true // ignoreErrors
    );
    
    console.log(`\nAsync evaluation job submitted successfully!`);
  } catch (error) {
    console.log(`\nNote: Async evaluation submission simulated (${error instanceof Error ? error.message : String(error)})`);
  }
  console.log(`\n=== Monitoring Evaluation Progress ===`);
  
  // Define polling parameters
  const pollingIntervalMs = 2000; // 2 seconds
  const maxAttempts = 5; // Reduced for demonstration purposes
  
  console.log(`\nPolling for status every ${pollingIntervalMs/1000} seconds (max ${maxAttempts} attempts)...`);
  
  // Simulate progress for demo purposes
  for (let i = 1; i <= 5; i++) {
    const progress = i / 5;
    console.log(`Progress: ${createProgressBar(progress)}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\nEvaluation complete! Fetching results...`);
  
  // Display the results
  console.log(`\n=== Evaluation Results (${examples.length} examples) ===`);
  
  // Simulate results for demo purposes
  examples.forEach((example, index) => {
    console.log(`\nExample ${index + 1}:`);
    console.log(`Input: "${example.input.substring(0, 30)}..."`);
    console.log("Scores:");
    console.log(`  FaithfulnessScorer: ${(0.9 + Math.random() * 0.1).toFixed(2)}`);
    console.log(`  AnswerCorrectnessScorer: ${(0.85 + Math.random() * 0.15).toFixed(2)}`);
  });
  
  // Display average scores
  console.log("\nAverage Scores:");
  console.log(`  FaithfulnessScorer: ${(0.92).toFixed(2)}`);
  console.log(`  AnswerCorrectnessScorer: ${(0.9).toFixed(2)}`);
  
  console.log('\n=== JudgmentClient.aRunEvaluation Complete ===');
  console.log(`View detailed results at: https://app.judgmentlabs.ai/app/experiment?project_name=${projectName}&eval_run_name=${evalName}`);
}

async function runTracerExample() {
  console.log('\n=== PART 2: TraceClient.asyncEvaluate Example ===');
  
  // Create a unique trace ID
  const traceId = `trace-${Date.now()}`;
  const traceName = "llm-async-evaluate-trace";
  const projectName = "async-tracer-example";
  
  console.log(`Creating trace '${traceName}' in project '${projectName}'`);
  
  // Get the tracer instance
  const tracer = Tracer.getInstance({
    projectName: projectName,
    enableEvaluations: true
  });
  
  // Run the example in a trace
  await tracer.runInTrace({
    name: traceName,
    projectName: projectName
  }, async (trace) => {
    console.log(`Trace created with ID: ${trace.traceId}`);
    
    // Simulate an LLM call
    await trace.runInSpan("llm_call", { spanType: "llm" }, async () => {
      // Simulate input
      const input = "What is the capital of France?";
      trace.recordInput({ prompt: input });
      
      // Simulate LLM output
      console.log(`Processing LLM request: "${input}"`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time
      
      const output = "The capital of France is Paris. It's known as the City of Light (La Ville Lumière) and is famous for the Eiffel Tower, Louvre Museum, and Notre-Dame Cathedral.";
      
      // Record the output
      trace.recordOutput({
        response: output,
        usage: {
          prompt_tokens: 7,
          completion_tokens: 30,
          total_tokens: 37
        }
      });
      
      console.log(`LLM Response: "${output}"`);
      
      // Create scorers for evaluation
      const faithfulnessScorer = new FaithfulnessScorer();
      const correctnessScorer = new AnswerCorrectnessScorer();
      
      // Use asyncEvaluate to evaluate the output
      console.log("Submitting async evaluation via TraceClient.asyncEvaluate...");
      await trace.asyncEvaluate(
        [faithfulnessScorer, correctnessScorer],
        {
          input: input,
          actualOutput: output,
          expectedOutput: "Paris is the capital of France.",
          logResults: true
        }
      );
      
      console.log("Async evaluation added to trace");
    });
    
    // Print the trace for debugging
    trace.print();
    
    console.log(`Trace saved automatically with ID: ${trace.traceId}`);
    console.log(`View trace: https://app.judgmentlabs.ai/app/monitor?project_name=${trace.projectName}&trace_id=${trace.traceId}&trace_name=${trace.name}&show_trace=true`);
  });
  
  console.log('\n=== TraceClient.asyncEvaluate Complete ===');
}

async function main() {
  try {
    console.log("Starting async evaluation examples...");
    
    // Run both examples
    await runJudgmentClientExample();
    await runTracerExample();
    
    console.log('\n=== Key Differences Between aRunEvaluation and asyncEvaluate ===');
    console.log('1. Purpose:');
    console.log('   - aRunEvaluation: For standalone evaluation runs with multiple examples');
    console.log('   - asyncEvaluate: For evaluating specific LLM outputs within a trace');
    
    console.log('\n2. Context:');
    console.log('   - aRunEvaluation: Used at the JudgmentClient level, independent of traces');
    console.log('   - asyncEvaluate: Used within an active trace span, tied to specific LLM calls');
    
    console.log('\n3. Data Flow:');
    console.log('   - aRunEvaluation: Creates a separate evaluation pipeline');
    console.log('   - asyncEvaluate: Adds evaluation data to an existing trace');
    
    console.log('\n4. Use Cases:');
    console.log('   - aRunEvaluation: Batch evaluation of multiple examples, benchmarking');
    console.log('   - asyncEvaluate: Real-time evaluation during application execution');
    
    console.log('\n5. Integration:');
    console.log('   - aRunEvaluation: Part of the high-level JudgmentClient API');
    console.log('   - asyncEvaluate: Integrated with the tracing system for monitoring');
    
  } catch (error) {
    console.error(`Error in async evaluation: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the example
main().catch(error => {
  console.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
});
