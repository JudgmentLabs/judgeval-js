/**
 * LLM Workflow Analysis with Async Evaluation and Tracing
 * 
 * This example demonstrates a comprehensive approach to analyzing an LLM workflow:
 * 1. Using multiple scorers to evaluate LLM responses
 * 2. Tracing the entire workflow with spans for each step
 * 3. Performing async evaluation within the trace
 * 4. Analyzing the results with detailed metrics
 * 
 * This represents a real-world scenario where you might want to:
 * - Track the performance of your LLM application
 * - Evaluate the quality of responses using multiple criteria
 * - Identify areas for improvement in your prompt engineering
 */

import * as dotenv from 'dotenv';
import { Example, ExampleBuilder } from '../data/example';
import { JudgmentClient } from '../judgment-client';
import { 
  FaithfulnessScorer,
  AnswerCorrectnessScorer,
  AnswerRelevancyScorer,
  GroundednessScorer,
  HallucinationScorer,
  InstructionAdherenceScorer
} from '../scorers/api-scorer';
import { ScoringResult } from '../data/result';
import { Tracer } from '../common/tracer';
import { v4 as uuidv4 } from 'uuid';
import logger from '../common/logger';

// Load environment variables
dotenv.config();

// Helper function to create a simple ASCII progress bar
function createProgressBar(percent: number, length: number = 20): string {
  const filled = Math.round(percent * length);
  const empty = length - filled;
  return `[${'='.repeat(filled)}${' '.repeat(empty)}] ${Math.round(percent * 100)}%`;
}

// Sample customer service conversation data
const customerServiceData = [
  {
    customer: "I ordered a pair of shoes last week, but they still haven't shipped. Order #12345.",
    context: [
      "Order #12345 was placed on April 3, 2025",
      "Order status: Processing",
      "Expected shipping date: April 12, 2025",
      "Customer is a premium member"
    ],
    agentResponse: "I apologize for the delay with your order #12345. I can see that your order is still processing and is scheduled to ship by April 12. As a premium member, would you like me to expedite your shipping at no additional cost?",
    expectedResponse: "I apologize for the delay. Your order #12345 is still processing and will ship by April 12. As a premium member, I can expedite your shipping at no extra cost if you'd like."
  },
  {
    customer: "The product I received is damaged. Can I get a refund?",
    context: [
      "Return policy: 30-day full refund for damaged items",
      "Customer purchased item 14 days ago",
      "Customer has submitted photos of the damage"
    ],
    agentResponse: "I'm sorry to hear that your product arrived damaged. I've reviewed the photos you submitted, and I can confirm that you're eligible for a full refund under our 30-day return policy. I've initiated the refund process, and you should see the funds back in your account within 3-5 business days. Would you like to return the damaged item or keep it?",
    expectedResponse: "I'm sorry about the damaged product. Based on the photos and our 30-day policy, I've approved your full refund. The money will return to your account in 3-5 business days. Would you like to return or keep the damaged item?"
  },
  {
    customer: "I'm trying to change my delivery address for my upcoming order.",
    context: [
      "Order #78901 placed yesterday",
      "Current status: Processing",
      "Current delivery address: 123 Main St, Anytown, USA",
      "Order has not been shipped yet"
    ],
    agentResponse: "I'd be happy to help you change the delivery address for order #78901. Since your order is still processing and hasn't shipped yet, we can update the address. Could you please provide the new delivery address you'd like to use? Once you provide it, I'll update your order immediately.",
    expectedResponse: "I can help change the delivery address for order #78901 since it's still processing and hasn't shipped. Please provide your new address, and I'll update it immediately."
  }
];

/**
 * Simulates a customer service LLM application with tracing and evaluation
 */
async function runCustomerServiceLLMWorkflow() {
  console.log('=== Customer Service LLM Workflow Analysis ===\n');
  
  // Create a unique run ID for this test
  const runId = Date.now();
  const projectName = 'customer-service-analysis';
  const evalRunName = `cs-eval-${runId}`;
  
  console.log(`Project: ${projectName}`);
  console.log(`Evaluation Run: ${evalRunName}`);
  
  // Initialize the JudgmentClient
  console.log('\nInitializing JudgmentClient...');
  const client = JudgmentClient.getInstance();
  console.log('JudgmentClient initialized successfully!');
  
  // Initialize the Tracer
  console.log('Initializing Tracer...');
  const tracer = Tracer.getInstance({
    projectName,
    enableEvaluations: true
  });
  console.log('Tracer initialized successfully!');
  
  // Create examples for evaluation
  console.log('\nPreparing examples for evaluation...');
  const examples = customerServiceData.map(data => {
    return new ExampleBuilder()
      .input(data.customer)
      .actualOutput(data.agentResponse)
      .expectedOutput(data.expectedResponse)
      .retrievalContext(data.context)
      .build();
  });
  console.log(`Created ${examples.length} examples for evaluation`);
  
  // Create scorers with different weights and thresholds
  console.log('\nConfiguring scorers...');
  const scorers = [
    new FaithfulnessScorer(0.8),            // High importance on factual accuracy
    new AnswerCorrectnessScorer(0.7),       // Important for customer service accuracy
    new AnswerRelevancyScorer(0.9),         // Critical for customer service
    new GroundednessScorer(0.6),            // Important but not critical
    new HallucinationScorer(0.5),           // Check for hallucinations
    new InstructionAdherenceScorer(0.95)    // Critical for following instructions
  ];
  console.log(`Configured ${scorers.length} scorers with appropriate weights`);
  
  // Start the trace for the entire workflow
  console.log('\nStarting workflow trace...');
  const traceName = `customer-service-workflow-${runId}`;
  
  await tracer.runInTrace({
    name: traceName,
    projectName
  }, async (trace) => {
    console.log(`Trace started with ID: ${trace.traceId}`);
    
    // PART 1: Run async evaluation on all examples
    await trace.runInSpan("batch_evaluation", { spanType: "tool" }, async () => {
      console.log('\n=== Running Batch Async Evaluation ===');
      
      try {
        // Submit the async evaluation
        console.log('Submitting async evaluation job...');
        await client.aRunEvaluation(
          examples,
          scorers,
          "meta-llama/Meta-Llama-3-8B-Instruct-Turbo", // Using a specific model
          undefined, // aggregator
          { workflow: "customer_service", timestamp: runId }, // metadata
          true, // logResults
          projectName,
          evalRunName,
          true, // override
          true, // useJudgment
          true  // ignoreErrors
        );
        
        console.log('Async evaluation job submitted successfully!');
        
        // In a real-world scenario, you would poll for status
        // For this example, we'll simulate the progress
        console.log('\nSimulating evaluation progress...');
        for (let i = 1; i <= 5; i++) {
          const progress = i / 5;
          console.log(`Progress: ${createProgressBar(progress)}`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log('\nBatch evaluation complete!');
        console.log(`View results at: https://app.judgmentlabs.ai/app/experiment?project_name=${projectName}&eval_run_name=${evalRunName}`);
      } catch (error) {
        console.log(`Note: Batch evaluation simulated (${error instanceof Error ? error.message : String(error)})`);
      }
    });
    
    // PART 2: Process each customer query individually with tracing
    console.log('\n=== Processing Individual Customer Queries ===');
    
    for (let i = 0; i < customerServiceData.length; i++) {
      const data = customerServiceData[i];
      const queryId = uuidv4().substring(0, 8);
      
      await trace.runInSpan(`customer_query_${i+1}`, { spanType: "chain" }, async () => {
        console.log(`\nProcessing Customer Query #${i+1}: "${data.customer.substring(0, 40)}..."`);
        
        // Step 1: Context retrieval
        await trace.runInSpan("context_retrieval", { spanType: "tool" }, async () => {
          console.log("Retrieving context...");
          trace.recordInput({ query: data.customer });
          await new Promise(resolve => setTimeout(resolve, 300)); // Simulate retrieval time
          trace.recordOutput({ context: data.context });
          console.log(`Retrieved ${data.context.length} context items`);
        });
        
        // Step 2: LLM response generation
        await trace.runInSpan("llm_generation", { spanType: "llm" }, async () => {
          // Prepare the prompt with context
          const prompt = `
Customer query: ${data.customer}

Context:
${data.context.map(c => `- ${c}`).join('\n')}

Respond to the customer query using the provided context. Be helpful, accurate, and concise.
`;
          
          trace.recordInput({ prompt });
          
          console.log("Generating LLM response...");
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate LLM processing time
          
          // In a real scenario, this would be the actual LLM call
          // For this example, we'll use the pre-defined response
          const response = data.agentResponse;
          
          trace.recordOutput({
            response,
            usage: {
              prompt_tokens: prompt.length / 4, // Rough estimate
              completion_tokens: response.length / 4, // Rough estimate
              total_tokens: (prompt.length + response.length) / 4 // Rough estimate
            }
          });
          
          console.log(`LLM Response: "${response.substring(0, 60)}..."`);
          
          // Evaluate the LLM response asynchronously within the trace
          console.log("Submitting async evaluation for this response...");
          
          const example = new ExampleBuilder()
            .input(data.customer)
            .actualOutput(response)
            .expectedOutput(data.expectedResponse)
            .retrievalContext(data.context)
            .build();
          
          // Use a subset of scorers for individual evaluations
          const responseScorers = [
            new FaithfulnessScorer(0.8),
            new AnswerRelevancyScorer(0.9),
            new HallucinationScorer(0.95)
          ];
          
          await trace.asyncEvaluate(
            responseScorers,
            {
              input: data.customer,
              actualOutput: response,
              expectedOutput: data.expectedResponse,
              retrievalContext: data.context,
              logResults: true
            }
          );
          
          console.log("Async evaluation added to trace");
        });
      });
    }
    
    // PART 3: Analyze the results
    await trace.runInSpan("results_analysis", { spanType: "tool" }, async () => {
      console.log('\n=== Analyzing Workflow Results ===');
      
      // In a real scenario, you would fetch the actual results
      // For this example, we'll simulate the analysis
      
      console.log('\nScorer Performance Summary:');
      console.log('----------------------------');
      console.log('FaithfulnessScorer:         0.87 (Good)');
      console.log('AnswerCorrectnessScorer:    0.92 (Excellent)');
      console.log('AnswerRelevancyScorer:      0.95 (Excellent)');
      console.log('GroundednessScorer:         0.89 (Good)');
      console.log('HallucinationScorer:        0.94 (Excellent)');
      console.log('InstructionAdherenceScorer: 0.98 (Excellent)');
      
      console.log('\nAreas for Improvement:');
      console.log('----------------------');
      console.log('1. Faithfulness: Ensure all context information is accurately reflected');
      console.log('2. Groundedness: Improve grounding in the provided context');
      
      console.log('\nStrengths:');
      console.log('----------');
      console.log('1. Relevancy: Responses directly address customer queries');
      console.log('2. Low Hallucination: No fabricated information detected');
      console.log('3. Correctness: Responses align well with expected outputs');
    });
    
    // Display trace information
    console.log('\n=== Workflow Trace Complete ===');
    console.log(`Trace ID: ${trace.traceId}`);
    console.log(`View trace details at: https://app.judgmentlabs.ai/app/monitor?project_name=${projectName}&trace_id=${trace.traceId}&trace_name=${traceName}&show_trace=true`);
  });
  
  // PART 4: Recommendations based on the analysis
  console.log('\n=== Recommendations ===');
  console.log('1. Prompt Engineering: Add explicit instructions to include all context items');
  console.log('2. Model Selection: Current model performs well for customer service tasks');
  console.log('3. Monitoring: Set up continuous evaluation with these scorers');
  console.log('4. Thresholds: Set minimum score thresholds of 0.85 for production use');
  
  console.log('\n=== Customer Service LLM Workflow Analysis Complete ===');
}

// Run the example
async function main() {
  try {
    console.log('Starting LLM workflow analysis with tracing and async evaluation...\n');
    await runCustomerServiceLLMWorkflow();
    console.log('\nAnalysis complete! You can view the detailed results and traces in the Judgment UI.');
  } catch (error) {
    console.error('Error running the workflow analysis:', error);
  }
}

// Execute the main function
main().catch(error => {
  console.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
