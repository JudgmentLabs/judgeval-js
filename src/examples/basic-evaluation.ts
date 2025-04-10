import * as dotenv from 'dotenv';
import { Example, ExampleBuilder } from '../data/example';
import { JudgmentClient } from '../judgment-client';
import { 
  FaithfulnessScorer, 
  AnswerRelevancyScorer,
  AnswerCorrectnessScorer,
  HallucinationScorer,
  ContextualRelevancyScorer,
  ContextualPrecisionScorer,
  ContextualRecallScorer,
  SummarizationScorer,
  ComparisonScorer,
  InstructionAdherenceScorer,
  JsonCorrectnessScorer,
  ExecutionOrderScorer,
  GroundednessScorer
} from '../scorers/api-scorer';
import logger from '../common/logger';

// Load environment variables
dotenv.config();

// Ensure necessary environment variables are set
if (!process.env.JUDGMENT_API_KEY) {
  console.error("Error: JUDGMENT_API_KEY environment variable is not set.");
  process.exit(1);
}

if (!process.env.JUDGMENT_ORG_ID) {
  console.error("Error: JUDGMENT_ORG_ID environment variable is not set.");
  process.exit(1);
}

async function runBasicEvaluation() {
  // Completely disable all logging
  process.env.DISABLE_LOGGING = 'true';
  
  // Initialize the JudgmentClient
  const judgmentClient = JudgmentClient.getInstance();
  console.log('Successfully initialized JudgmentClient!');

  // Create examples for different scorer types
  const examples = {
    // Basic examples for simple scorers
    basic: [
      new ExampleBuilder()
        .input("What is the capital of France?")
        .actualOutput("The capital of France is Paris.")
        .expectedOutput("Paris is the capital of France.")
        .build(),
      new ExampleBuilder()
        .input("What is the tallest mountain in the world?")
        .actualOutput("Mount Everest is the tallest mountain in the world.")
        .expectedOutput("Mount Everest is the tallest mountain in the world.")
        .build()
    ],
    
    // Examples for AnswerRelevancy scorer
    answerRelevancy: [
      new ExampleBuilder()
        .input("What's the capital of France?")
        .actualOutput("The capital of France is Paris.")
        .build(),
      new ExampleBuilder()
        .input("What's the capital of France?")
        .actualOutput("There's a lot to do in Marseille. Lots of bars, restaurants, and museums.")
        .build()
    ],
    
    // Examples for Contextual scorers
    contextual: [
      new ExampleBuilder()
        .input("Based on the context, what is the capital of France?")
        .actualOutput("According to the context, the capital of France is Paris.")
        .context([
          "France is a country in Western Europe.",
          "Paris is the capital and most populous city of France.",
          "The Eiffel Tower is located in Paris."
        ])
        .build()
    ],
    
    // Examples for Faithfulness scorer
    faithfulness: [
      new ExampleBuilder()
        .input("What's the capital of France?")
        .actualOutput("The capital of France is Paris. It's known for the Eiffel Tower.")
        .context([
          "France is a country in Western Europe.",
          "Paris is the capital of France.",
          "The Eiffel Tower is a landmark in Paris."
        ])
        .build()
    ],
    
    // Examples for Hallucination scorer
    hallucination: [
      new ExampleBuilder()
        .input("What's the capital of France?")
        .actualOutput("The capital of France is Paris, which is known for its beautiful beaches and tropical climate.")
        .build()
    ],
    
    // Examples for Summarization scorer
    summarization: [
      new ExampleBuilder()
        .input("Summarize the following text: France is a country in Western Europe. Paris is the capital of France. The Eiffel Tower is located in Paris.")
        .actualOutput("France is a Western European country with Paris as its capital, home to the Eiffel Tower.")
        .expectedOutput("France is a Western European country. Paris is its capital and has the Eiffel Tower.")
        .build()
    ],
    
    // Examples for JSON Correctness scorer
    jsonCorrectness: [
      new ExampleBuilder()
        .input("Convert this to JSON: Name: John, Age: 30, City: New York")
        .actualOutput('{"name": "John", "age": 30, "city": "New York"}')
        .expectedOutput('{"name": "John", "age": 30, "city": "New York"}')
        .build()
    ],
    
    // Examples for Instruction Adherence scorer
    instructionAdherence: [
      new ExampleBuilder()
        .input("List three European capitals.")
        .actualOutput("Three European capitals are Paris, London, and Berlin.")
        .build()
    ],
    
    // Examples for Comparison scorer
    comparison: [
      new ExampleBuilder()
        .input("Which is better for a beginner, Python or C++?")
        .actualOutput("Python is generally considered better for beginners because of its simpler syntax and readability.")
        .expectedOutput("Python is often recommended for beginners due to its readable syntax and gentle learning curve.")
        .build()
    ],
    
    // Examples for Execution Order scorer
    executionOrder: [
      new ExampleBuilder()
        .input("Describe the steps to make a sandwich.")
        .actualOutput("1. Get bread. 2. Add condiments. 3. Add fillings. 4. Close the sandwich.")
        .expectedOutput("1. Get bread. 2. Add condiments. 3. Add fillings. 4. Close the sandwich.")
        .build()
    ]
  };

  // Set up evaluation parameters
  const projectName = 'js-sdk-all-scorers';
  const evalRunName = `all-scorers-eval-${Date.now()}`;
  const model = 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo';

  try {
    // Directly format and print results in Python SDK format
    function formatPythonOutput(results: any[], projectName: string, evalName: string) {
      console.log('\n                     ');
      console.log(' You can view your evaluation results here: View Results');
      console.log('');
      
      let hasFailures = false;

      for (const result of results) {
        const success = result.success || (result.scorersData?.every((s: any) => s.success) ?? false);
        
        if (!success) {
          hasFailures = true;
          console.log('=== Test Failure Details ===');
          
          const input = result.dataObject?.input || result.example?.input;
          const actualOutput = result.dataObject?.actualOutput || result.example?.actualOutput;
          const retrievalContext = result.dataObject?.retrievalContext || result.example?.retrievalContext;
          
          console.log(`Input: ${input}`);
          console.log(`Output: ${actualOutput}`);
          console.log(`Success: False`);
          
          if (retrievalContext && retrievalContext.length > 0) {
            console.log(`Retrieval Context: ${JSON.stringify(retrievalContext)}`);
          } else {
            console.log('Retrieval Context: None');
          }
          
          const scorersData = result.scorersData || result.scores;
          
          if (scorersData && scorersData.length > 0) {
            console.log('\nScorer Details:');
            for (const scorer of scorersData) {
              if (!scorer.success) {
                console.log(`- Name: ${scorer.name}`);
                console.log(`- Score: ${scorer.score}`);
                console.log(`- Threshold: ${scorer.threshold}`);
                console.log(`- Success: False`);
                if (scorer.reason) {
                  console.log(`- Reason: ${scorer.reason}`);
                }
                console.log(`- Error: ${scorer.error || 'None'}`);
              }
            }
          }
          
          console.log('');
        }
      }

      if (!hasFailures) {
        console.log('All tests passed successfully!\n');
      }
    }
    
    // Test AnswerRelevancy scorer
    const arResults = await judgmentClient.evaluate({
      examples: examples.answerRelevancy,
      scorers: [new AnswerRelevancyScorer(0.7)],
      evalName: `${evalRunName}-ar`,
      projectName: projectName,
      model: model
    });
    formatPythonOutput(arResults, projectName, `${evalRunName}-ar`);

    // Test AnswerCorrectness scorer
    const acResults = await judgmentClient.evaluate({
      examples: examples.basic,
      scorers: [new AnswerCorrectnessScorer(0.7)],
      evalName: `${evalRunName}-ac`,
      projectName: projectName,
      model: model
    });
    formatPythonOutput(acResults, projectName, `${evalRunName}-ac`);

    // Test Faithfulness scorer
    const faithResults = await judgmentClient.evaluate({
      examples: examples.faithfulness,
      scorers: [new FaithfulnessScorer(0.7)],
      evalName: `${evalRunName}-faith`,
      projectName: projectName,
      model: model
    });
    formatPythonOutput(faithResults, projectName, `${evalRunName}-faith`);

    // Test Hallucination scorer
    const hallResults = await judgmentClient.evaluate({
      examples: examples.hallucination,
      scorers: [new HallucinationScorer(0.7)],
      evalName: `${evalRunName}-hall`,
      projectName: projectName,
      model: model
    });
    formatPythonOutput(hallResults, projectName, `${evalRunName}-hall`);

    // Test Contextual scorers
    const contextualScorers = [
      new ContextualRelevancyScorer(0.7),
      new ContextualPrecisionScorer(0.7),
      new ContextualRecallScorer(0.7)
    ];
    
    const contextResults = await judgmentClient.evaluate({
      examples: examples.contextual,
      scorers: contextualScorers,
      evalName: `${evalRunName}-context`,
      projectName: projectName,
      model: model
    });
    formatPythonOutput(contextResults, projectName, `${evalRunName}-context`);

    // Test Summarization scorer
    const summResults = await judgmentClient.evaluate({
      examples: examples.summarization,
      scorers: [new SummarizationScorer(0.7)],
      evalName: `${evalRunName}-summ`,
      projectName: projectName,
      model: model
    });
    formatPythonOutput(summResults, projectName, `${evalRunName}-summ`);

    // Test JSON Correctness scorer
    const jsonResults = await judgmentClient.evaluate({
      examples: examples.jsonCorrectness,
      scorers: [new JsonCorrectnessScorer(0.7)],
      evalName: `${evalRunName}-json`,
      projectName: projectName,
      model: model
    });
    formatPythonOutput(jsonResults, projectName, `${evalRunName}-json`);

    // Test Instruction Adherence scorer
    const iaResults = await judgmentClient.evaluate({
      examples: examples.instructionAdherence,
      scorers: [new InstructionAdherenceScorer(0.7)],
      evalName: `${evalRunName}-ia`,
      projectName: projectName,
      model: model
    });
    formatPythonOutput(iaResults, projectName, `${evalRunName}-ia`);

    // Test Comparison scorer
    const compResults = await judgmentClient.evaluate({
      examples: examples.comparison,
      scorers: [new ComparisonScorer(0.5)],
      evalName: `${evalRunName}-comp`,
      projectName: projectName,
      model: model
    });
    formatPythonOutput(compResults, projectName, `${evalRunName}-comp`);

    // Test Execution Order scorer
    const eoResults = await judgmentClient.evaluate({
      examples: examples.executionOrder,
      scorers: [new ExecutionOrderScorer(0.7)],
      evalName: `${evalRunName}-eo`,
      projectName: projectName,
      model: model
    });
    formatPythonOutput(eoResults, projectName, `${evalRunName}-eo`);
  } catch (error) {
    console.error(`Error running evaluations: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the example
runBasicEvaluation();
