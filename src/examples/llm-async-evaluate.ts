/**
 * LLM Async Evaluate Example
 * 
 * This example demonstrates how to use the asyncEvaluate method
 * to evaluate LLM outputs during a trace. It shows how to:
 * 1. Create a trace
 * 2. Use the asyncEvaluate method to evaluate LLM outputs
 * 3. Save the trace with evaluation results
 */

import * as dotenv from 'dotenv';
import { Tracer } from '../common/tracer';
import { 
  FaithfulnessScorer,
  AnswerCorrectnessScorer
} from '../scorers/api-scorer';

// Load environment variables
dotenv.config();

async function main() {
  console.log("Starting LLM async evaluate example...");
  
  // Get the tracer instance
  const tracer = Tracer.getInstance({
    projectName: "typescript-sdk-async-test",
    enableEvaluations: true
  });
  
  // Run the example in a trace
  await tracer.runInTrace({
    name: "llm-async-evaluate-trace",
    projectName: "typescript-sdk-async-test"
  }, async (trace) => {
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
      console.log("Submitting async evaluation...");
      await trace.asyncEvaluate(
        [faithfulnessScorer, correctnessScorer],
        {
          input: input,
          actualOutput: output,
          expectedOutput: "Paris is the capital of France.",
          logResults: true
        }
      );
    });
    
    // Print the trace for debugging
    trace.print();
    
    console.log(`Trace saved automatically with ID: ${trace.traceId}`);
    console.log(`View trace: https://app.judgmentlabs.ai/app/monitor?project_name=${trace.projectName}&trace_id=${trace.traceId}&trace_name=${trace.name}&show_trace=true`);
  });
}

// Run the example
main().catch(error => {
  console.error("Error in LLM async evaluate example:", error);
});
