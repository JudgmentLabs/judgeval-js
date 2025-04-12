/**
 * LLM Workflow Analysis with Async Evaluation and Tracing
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
import * as logger from '../common/logger';

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
  // Create a unique run ID for this test
  const runId = Date.now();
  const projectName = 'customer-service-analysis';
  const evalRunName = `cs-eval-${runId}`;
  

  const client = JudgmentClient.getInstance();

  const tracerInstance = Tracer.getInstance({
    projectName,
    enableEvaluations: true
  });
  
  // Create examples for evaluation
  const examples = customerServiceData.map(data => {
    return new ExampleBuilder()
      .input(data.customer)
      .actualOutput(data.agentResponse)
      .expectedOutput(data.expectedResponse)
      .retrievalContext(data.context)
      .build();
  });
  
  // Create scorers with different weights and thresholds
  const scorers = [
    new FaithfulnessScorer(0.8),            // High importance on factual accuracy
    new AnswerCorrectnessScorer(0.7),       // Important for customer service accuracy
    new AnswerRelevancyScorer(0.9),         // Critical for customer service
    new GroundednessScorer(0.6),            // Important but not critical
    new HallucinationScorer(0.5),           // Check for hallucinations
    new InstructionAdherenceScorer(0.95)    // Critical for following instructions
  ];
  
  // Start the trace for the entire workflow
  const traceName = `customer-service-workflow-${runId}`;
  
  // Store the trace ID and URL for later use
  let traceId = '';
  let traceUrl = '';
  
  await tracerInstance.runInTrace({
    name: traceName,
    projectName
  }, async (trace) => {
    // Store the trace ID for later use
    traceId = trace.traceId;
    traceUrl = `https://app.judgmentlabs.ai/app/monitor?project_name=${projectName}&trace_id=${traceId}&trace_name=${traceName}&show_trace=true`;
    
    // PART 1: Run async evaluation on all examples
    await trace.runInSpan("batch_evaluation", { spanType: "tool" }, async () => {
      
      try {
        // Submit the async evaluation
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
        
        // In a real-world scenario, you would poll for status
        // For this example, we'll simulate the progress
        for (let i = 1; i <= 5; i++) {
          const progress = i / 5;
          logger.info(`Progress: ${createProgressBar(progress)}`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        logger.error('Error running batch evaluation: ' + (error instanceof Error ? error.message : String(error)));
      }
    });
    
    // PART 2: Process each customer query individually with tracing
    for (let i = 0; i < customerServiceData.length; i++) {
      const data = customerServiceData[i];
      const queryId = uuidv4().substring(0, 8);
      
      await trace.runInSpan(`customer_query_${i+1}`, { spanType: "chain" }, async () => {
        
        // Step 1: Context retrieval
        await trace.runInSpan("context_retrieval", { spanType: "tool" }, async () => {
          trace.recordInput({ query: data.customer });
          await new Promise(resolve => setTimeout(resolve, 300)); // Simulate retrieval time
          trace.recordOutput({ context: data.context });
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
          
          // Evaluate the LLM response asynchronously within the trace
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
        });
      });
    }
    
    // PART 3: Analyze the results
    await trace.runInSpan("results_analysis", { spanType: "tool" }, async () => {
      
      // In a real scenario, you would fetch the actual results
      // For this example, we'll simulate the analysis
      
      // Create a structured analysis result object
      const analysisResults = {
        title: "Workflow Analysis Results",
        scorerPerformance: [
          { name: "FaithfulnessScorer", score: 0.87, rating: "Good" },
          { name: "AnswerCorrectnessScorer", score: 0.92, rating: "Excellent" },
          { name: "AnswerRelevancyScorer", score: 0.95, rating: "Excellent" },
          { name: "GroundednessScorer", score: 0.89, rating: "Good" },
          { name: "HallucinationScorer", score: 0.94, rating: "Excellent" },
          { name: "InstructionAdherenceScorer", score: 0.98, rating: "Excellent" }
        ],
        areasForImprovement: [
          "Faithfulness: Ensure all context information is accurately reflected",
          "Groundedness: Improve grounding in the provided context"
        ],
        strengths: [
          "Relevancy: Responses directly address customer queries",
          "Low Hallucination: No fabricated information detected",
          "Correctness: Responses align well with expected outputs"
        ]
      };
      
      // Use the standardized logger.print to display the results
      logger.print(analysisResults);
    });
    
    // Display trace information
    logger.info('\n=== Workflow Trace Complete ===');
    logger.info(`Trace ID: ${traceId}`);
    logger.info(`View trace details at: ${traceUrl}`);
  });
  
  // Return the analysis results instead of logging them directly
  return {
    recommendations: [
      'Prompt Engineering: Add explicit instructions to include all context items',
      'Model Selection: Current model performs well for customer service tasks',
      'Monitoring: Set up continuous evaluation with these scorers',
      'Thresholds: Set minimum score thresholds of 0.85 for production use'
    ],
    traceUrl
  };
}

// Run the example
async function main() {
  try {
    logger.info('Starting LLM workflow analysis with tracing and async evaluation...\n');
    const results = await runCustomerServiceLLMWorkflow();
    
    // Use the standardized logger to print the recommendations
    logger.print({
      title: "Customer Service LLM Workflow Recommendations",
      recommendations: results.recommendations
    });
    
    logger.info('\n=== Customer Service LLM Workflow Analysis Complete ===');
    logger.info('\nAnalysis complete! You can view the detailed results and traces in the Judgment UI.');
  } catch (error) {
    logger.error('Error running the workflow analysis: ' + (error instanceof Error ? error.message : String(error)));
  }
}

// Execute the main function
main().catch(error => {
  logger.error('Unhandled error: ' + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
