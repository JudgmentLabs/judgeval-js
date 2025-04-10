import * as dotenv from 'dotenv';
import { Example } from '../data/example';
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
import { APIJudgmentScorer } from '../scorers/base-scorer';

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
  console.log('Starting basic evaluation example with all scorers...');

  // Initialize the JudgmentClient
  const client = JudgmentClient.getInstance();

  // Create examples for different scorer types
  const examples = {
    // Basic examples for simple scorers
    basic: [
      Example.builder()
        .input("What is the capital of France?")
        .actualOutput("The capital of France is Paris.")
        .expectedOutput("Paris is the capital of France.")
        .build(),
      Example.builder()
        .input("What is the tallest mountain in the world?")
        .actualOutput("Mount Everest is the tallest mountain in the world.")
        .expectedOutput("Mount Everest is the tallest mountain in the world.")
        .build()
    ],
    
    // Examples for AnswerRelevancy scorer
    answerRelevancy: [
      Example.builder()
        .input("What's the capital of France?")
        .actualOutput("The capital of France is Paris.")
        .build(),
      Example.builder()
        .input("What's the capital of France?")
        .actualOutput("There's a lot to do in Marseille. Lots of bars, restaurants, and museums.")
        .build()
    ],
    
    // Examples for Contextual scorers
    contextual: [
      Example.builder()
        .input("Based on the context, what is the capital of France?")
        .actualOutput("According to the context, the capital of France is Paris.")
        .context([
          "France is a country in Western Europe.",
          "Paris is the capital and most populous city of France.",
          "France has many beautiful cities including Lyon, Marseille, and Nice."
        ])
        .build(),
      Example.builder()
        .input("What does the context say about French cuisine?")
        .actualOutput("The context mentions that French cuisine is known for its sophistication and influence on Western cuisines.")
        .context([
          "French cuisine is renowned worldwide for its sophistication.",
          "It has influenced many Western cuisines and is an important part of French culture.",
          "Some famous French dishes include coq au vin, bouillabaisse, and ratatouille."
        ])
        .build()
    ],
    
    // Examples for Faithfulness scorer
    faithfulness: [
      Example.builder()
        .input("What is the capital of France?")
        .actualOutput("The capital of France is Paris, which is located on the Seine River.")
        .context(["Paris is the capital of France and is located on the Seine River."])
        .build(),
      Example.builder()
        .input("What is the capital of France?")
        .actualOutput("The capital of France is Paris, which has a population of 50 million people.")
        .context(["Paris is the capital of France and has a population of about 2.2 million."])
        .build()
    ],
    
    // Examples for Hallucination scorer
    hallucination: [
      Example.builder()
        .input("What is the capital of France?")
        .actualOutput("The capital of France is Paris.")
        .build(),
      Example.builder()
        .input("What is the capital of France?")
        .actualOutput("The capital of France is Lyon, which is known for its beautiful architecture.")
        .build()
    ],
    
    // Examples for Summarization scorer
    summarization: [
      Example.builder()
        .input("Summarize the following text: France is a country in Western Europe. Paris is the capital and most populous city of France. France has many beautiful cities including Lyon, Marseille, and Nice.")
        .actualOutput("France is a Western European country with Paris as its capital and largest city. Other notable cities include Lyon, Marseille, and Nice.")
        .build()
    ],
    
    // Examples for JSON Correctness scorer
    jsonCorrectness: [
      Example.builder()
        .input("Return the following information as JSON: Name: John Smith, Age: 30, Occupation: Software Engineer")
        .actualOutput('{"name": "John Smith", "age": 30, "occupation": "Software Engineer"}')
        .build(),
      Example.builder()
        .input("Return the following information as JSON: Name: John Smith, Age: 30, Occupation: Software Engineer")
        .actualOutput('{"name": "John Smith", "age": "30", "job": "Software Engineer"}')
        .build()
    ],
    
    // Examples for Instruction Adherence scorer
    instructionAdherence: [
      Example.builder()
        .input("List three European capitals in alphabetical order.")
        .actualOutput("Amsterdam, Berlin, Copenhagen")
        .build(),
      Example.builder()
        .input("List three European capitals in alphabetical order.")
        .actualOutput("Paris is the capital of France, Berlin is the capital of Germany, and London is the capital of the UK.")
        .build()
    ],
    
    // Examples for Comparison scorer
    comparison: [
      Example.builder()
        .input("Compare these two responses: Response 1: The capital of France is Paris. Response 2: Paris is the capital city of France.")
        .actualOutput("Both responses correctly state that Paris is the capital of France, but they use slightly different wording.")
        .build()
    ],
    
    // Examples for Execution Order scorer
    executionOrder: [
      Example.builder()
        .input("Describe the steps to make a sandwich.")
        .actualOutput("1. Get bread. 2. Add condiments. 3. Add fillings. 4. Close the sandwich.")
        .expectedOutput("1. Get bread. 2. Add condiments. 3. Add fillings. 4. Close the sandwich.")
        .build()
    ]
  };

  // Create all scorer types with appropriate thresholds
  const scorers = [
    new AnswerRelevancyScorer(0.7),
    new AnswerCorrectnessScorer(0.7),
    new FaithfulnessScorer(0.7),
    new HallucinationScorer(0.7),
    new ContextualRelevancyScorer(0.7),
    new ContextualPrecisionScorer(0.7),
    new ContextualRecallScorer(0.7),
    new SummarizationScorer(0.7),
    new ComparisonScorer(0.5),
    new InstructionAdherenceScorer(0.7),
    new JsonCorrectnessScorer(0.7),
    new ExecutionOrderScorer(0.7),
    new GroundednessScorer(0.7)
  ];

  // Set up evaluation parameters
  // Use a supported model from Together API
  const model = "meta-llama/Meta-Llama-3-8B-Instruct-Turbo";
  const projectName = "js-sdk-all-scorers";
  const evalRunName = `all-scorers-eval-${Date.now()}`;
  const metadata = {
    description: "Evaluation example testing all scorers using the TypeScript SDK",
    version: "1.0.0"
  };

  // Run evaluations for each example type with appropriate scorers
  try {
    // Test AnswerRelevancy scorer
    console.log('\nTesting AnswerRelevancy scorer...');
    const arResults = await client.runEvaluation(
      examples.answerRelevancy,
      [new AnswerRelevancyScorer(0.7)] as Array<APIJudgmentScorer>,
      model,
      undefined,
      { ...metadata, test: "answer_relevancy" },
      true,
      projectName,
      `${evalRunName}-ar`,
      true,
      true,
      true
    );
    displayResults(arResults, "AnswerRelevancy");

    // Test AnswerCorrectness scorer
    console.log('\nTesting AnswerCorrectness scorer...');
    const acResults = await client.runEvaluation(
      examples.basic,
      [new AnswerCorrectnessScorer(0.7)] as Array<APIJudgmentScorer>,
      model,
      undefined,
      { ...metadata, test: "answer_correctness" },
      true,
      projectName,
      `${evalRunName}-ac`,
      true,
      true,
      true
    );
    displayResults(acResults, "AnswerCorrectness");

    // Test Faithfulness scorer
    console.log('\nTesting Faithfulness scorer...');
    const faithResults = await client.runEvaluation(
      examples.faithfulness,
      [new FaithfulnessScorer(0.7)] as Array<APIJudgmentScorer>,
      model,
      undefined,
      { ...metadata, test: "faithfulness" },
      true,
      projectName,
      `${evalRunName}-faith`,
      true,
      true,
      true
    );
    displayResults(faithResults, "Faithfulness");

    // Test Hallucination scorer
    console.log('\nTesting Hallucination scorer...');
    const hallResults = await client.runEvaluation(
      examples.hallucination,
      [new HallucinationScorer(0.7)] as Array<APIJudgmentScorer>,
      model,
      undefined,
      { ...metadata, test: "hallucination" },
      true,
      projectName,
      `${evalRunName}-hall`,
      true,
      true,
      true
    );
    displayResults(hallResults, "Hallucination");

    // Test Contextual scorers
    console.log('\nTesting Contextual scorers...');
    const contextualScorers = [
      new ContextualRelevancyScorer(0.7),
      new ContextualPrecisionScorer(0.7),
      new ContextualRecallScorer(0.7)
    ];
    const contextResults = await client.runEvaluation(
      examples.contextual,
      contextualScorers as Array<APIJudgmentScorer>,
      model,
      undefined,
      { ...metadata, test: "contextual" },
      true,
      projectName,
      `${evalRunName}-context`,
      true,
      true,
      true
    );
    displayResults(contextResults, "Contextual");

    // Test Summarization scorer
    console.log('\nTesting Summarization scorer...');
    const summResults = await client.runEvaluation(
      examples.summarization,
      [new SummarizationScorer(0.7)] as Array<APIJudgmentScorer>,
      model,
      undefined,
      { ...metadata, test: "summarization" },
      true,
      projectName,
      `${evalRunName}-summ`,
      true,
      true,
      true
    );
    displayResults(summResults, "Summarization");

    // Test JSON Correctness scorer
    console.log('\nTesting JSON Correctness scorer...');
    const jsonResults = await client.runEvaluation(
      examples.jsonCorrectness,
      [new JsonCorrectnessScorer(0.7)] as Array<APIJudgmentScorer>,
      model,
      undefined,
      { ...metadata, test: "json_correctness" },
      true,
      projectName,
      `${evalRunName}-json`,
      true,
      true,
      true
    );
    displayResults(jsonResults, "JSON Correctness");

    // Test Instruction Adherence scorer
    console.log('\nTesting Instruction Adherence scorer...');
    const iaResults = await client.runEvaluation(
      examples.instructionAdherence,
      [new InstructionAdherenceScorer(0.7)] as Array<APIJudgmentScorer>,
      model,
      undefined,
      { ...metadata, test: "instruction_adherence" },
      true,
      projectName,
      `${evalRunName}-ia`,
      true,
      true,
      true
    );
    displayResults(iaResults, "Instruction Adherence");

    // Test Comparison scorer
    console.log('\nTesting Comparison scorer...');
    const compResults = await client.runEvaluation(
      examples.comparison,
      [new ComparisonScorer(0.5)] as Array<APIJudgmentScorer>,
      model,
      undefined,
      { ...metadata, test: "comparison" },
      true,
      projectName,
      `${evalRunName}-comp`,
      true,
      true,
      true
    );
    displayResults(compResults, "Comparison");

    // Test Execution Order scorer
    console.log('\nTesting Execution Order scorer...');
    const eoResults = await client.runEvaluation(
      examples.executionOrder,
      [new ExecutionOrderScorer(0.7)] as Array<APIJudgmentScorer>,
      model,
      undefined,
      { ...metadata, test: "execution_order" },
      true,
      projectName,
      `${evalRunName}-eo`,
      true,
      true,
      true
    );
    displayResults(eoResults, "Execution Order");

    console.log(`\nAll evaluations completed and logged to project '${projectName}'`);
  } catch (error) {
    console.error('Error running evaluations:', error);
  }
}

// Helper function to display results
function displayResults(results: any[], scorerName: string) {
  console.log(`\n${scorerName} Results:`);
  results.forEach((result, index) => {
    console.log(`\nExample ${index + 1}:`);
    console.log(`Input: ${result.dataObject.input}`);
    console.log(`Actual Output: ${result.dataObject.actualOutput}`);
    if (result.dataObject.expectedOutput) {
      console.log(`Expected Output: ${result.dataObject.expectedOutput}`);
    }
    if (result.dataObject.context) {
      console.log(`Context: ${result.dataObject.context.join(' | ')}`);
    }
    
    if (result.error) {
      console.log(`Error: ${result.error}`);
    } else if (result.scorersData && result.scorersData.length > 0) {
      console.log('Scores:');
      result.scorersData.forEach((scorer: any) => {
        console.log(`  ${scorer.name}: ${scorer.score !== null ? scorer.score : 'null'} (threshold: ${scorer.threshold}, success: ${scorer.success})`);
      });
    } else {
      console.log('No scorer data available');
    }
  });
}

// Run the example
runBasicEvaluation();
