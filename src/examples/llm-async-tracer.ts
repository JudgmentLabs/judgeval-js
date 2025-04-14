/**
 * LLM Workflow Analysis with Async Evaluation and Tracing
 */

import * as dotenv from 'dotenv';
import { Example, ExampleBuilder } from '../data/example.js';
import { JudgmentClient } from '../judgment-client.js';
import { 
  FaithfulnessScorer,
  AnswerCorrectnessScorer,
  AnswerRelevancyScorer,
  GroundednessScorer,
  HallucinationScorer,
  InstructionAdherenceScorer
} from '../scorers/api-scorer.js';
import { ScoringResult } from '../data/result.js';
import { Tracer, TraceClient } from '../common/tracer.js';
import { v4 as uuidv4 } from 'uuid';
import * as logger from '../common/logger.js';

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
    new FaithfulnessScorer(0.8, undefined, false, true, true, true),            // High importance on factual accuracy
    new AnswerCorrectnessScorer(0.7, undefined, false, true, true, true),       // Important for customer service accuracy
    new AnswerRelevancyScorer(0.9, undefined, false, true, true, true),         // Critical for customer service
    new GroundednessScorer(0.6, undefined, false, true, true, true),            // Important but not critical
    new HallucinationScorer(0.5, undefined, false, true, true, true),           // Check for hallucinations
    new InstructionAdherenceScorer(0.95, undefined, false, true, true, true)    // Critical for following instructions
  ];
  
  const traceName = `customer-service-workflow-${runId}`;
  
  let traceId = '';
  let traceUrl = '';
  
  // Use tracer.trace() generator pattern
  for (const traceClient of tracerInstance.trace(traceName, { projectName })) {
    traceId = traceClient.traceId;
    traceUrl = `https://app.judgmentlabs.ai/app/monitor?project_name=${projectName}&trace_id=${traceId}&trace_name=${traceName}&show_trace=true`;
    logger.info(`Trace started: ${traceName} (ID: ${traceId})`);

    // PART 1: Run async evaluation on all examples using traceClient.span()
    for (const span1 of traceClient.span("batch_evaluation", { spanType: "tool" })) {
      logger.info("Starting span: batch_evaluation");
      try {
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
        
        // Simulate progress
        for (let i = 1; i <= 5; i++) {
          const progress = i / 5;
          logger.info(`Progress: ${createProgressBar(progress)}`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Error running batch evaluation: ' + errorMsg);
        if (span1) span1.recordError(error);
      }
      logger.info("Finishing span: batch_evaluation");
    } // Span batch_evaluation ends

    // PART 2: Process each customer query individually
    for (let i = 0; i < customerServiceData.length; i++) {
      const data = customerServiceData[i];
      const queryId = uuidv4().substring(0, 8);

      // Outer span for the entire query processing using traceClient.span()
      for (const span_chain of traceClient.span(`customer_query_${i+1}`, { spanType: "chain" })) {
        logger.info(`Starting chain span: customer_query_${i+1}`);
        try {
          // Step 1: Context retrieval span using span_chain.span()
          for (const span_retrieval of span_chain.span("context_retrieval", { spanType: "tool" })) {
            logger.info("Starting span: context_retrieval");
            try {
              span_retrieval.recordInput({ query: data.customer });
              await new Promise(resolve => setTimeout(resolve, 300)); // Simulate
              span_retrieval.recordOutput({ context: data.context });
            } catch (innerError) {
              const errorMsg = innerError instanceof Error ? innerError.message : String(innerError);
              logger.error('Error in context_retrieval span: ' + errorMsg);
              if (span_retrieval) span_retrieval.recordError(innerError);
            }
            logger.info("Finishing span: context_retrieval");
          } // Span context_retrieval ends

          // Step 2: LLM response generation span using span_chain.span()
          for (const span_llm of span_chain.span("llm_generation", { spanType: "llm" })) {
            logger.info("Starting span: llm_generation");
            try {
              const prompt = `
Customer query: ${data.customer}

Context:
${data.context.map(c => `- ${c}`).join('\n')}

Respond to the customer query using the provided context. Be helpful, accurate, and concise.
`;
              span_llm.recordInput({ prompt });
              await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate
              const response = data.agentResponse;
              span_llm.recordOutput({
                response,
                usage: {
                  prompt_tokens: prompt.length / 4, // Rough estimate
                  completion_tokens: response.length / 4, // Rough estimate
                  total_tokens: (prompt.length + response.length) / 4 // Rough estimate
                }
              });

              // Evaluate response using the traceClient from the outer loop
              const responseScorers = [
                new FaithfulnessScorer(0.8, undefined, false, true, true, true),
                new AnswerRelevancyScorer(0.9, undefined, false, true, true, true),
                new HallucinationScorer(0.95, undefined, false, true, true, true)
              ];
              await traceClient.asyncEvaluate(responseScorers, {
                input: data.customer,
                actualOutput: response,
                expectedOutput: data.expectedResponse,
                retrievalContext: data.context,
                logResults: true
              });
            } catch (innerError) {
              const errorMsg = innerError instanceof Error ? innerError.message : String(innerError);
              logger.error('Error in llm_generation span: ' + errorMsg);
              if (span_llm) span_llm.recordError(innerError);
            }
            logger.info("Finishing span: llm_generation");
          } // Span llm_generation ends

        } catch (outerError) {
           const errorMsg = outerError instanceof Error ? outerError.message : String(outerError);
           logger.error(`Error in chain span customer_query_${i+1}: ` + errorMsg);
           if (span_chain) span_chain.recordError(outerError);
        }
        logger.info(`Finishing chain span: customer_query_${i+1}`);
      } // Span customer_query ends
    }

    // PART 3: Analyze the results span using traceClient.span()
    for (const span_analysis of traceClient.span("results_analysis", { spanType: "tool" })) {
      logger.info("Starting span: results_analysis");
      try {
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
        logger.print(analysisResults);
        if (span_analysis) span_analysis.recordOutput(analysisResults);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Error in results_analysis span: ' + errorMsg);
        if (span_analysis) span_analysis.recordError(error);
      }
      logger.info("Finishing span: results_analysis");
    } // Span results_analysis ends

    logger.info('\n=== Workflow Trace Complete ===');
    logger.info(`Trace ID: ${traceId}`);
    logger.info(`View trace details at: ${traceUrl}`);
  } // Trace ends

  // Return the analysis results and trace URL
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
