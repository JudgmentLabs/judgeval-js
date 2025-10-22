import { Example } from "./src/data";
import { JudgmentClient } from "./src/judgment-client";
import {
  AnswerCorrectnessScorer,
  AnswerRelevancyScorer,
} from "./src/scorers/api_scorers";
import { ExampleScorer } from "./src/scorers/example-scorer";

const client = new JudgmentClient();

class WordLengthScorer extends ExampleScorer {
  async scoreExample(example: { input: string }): Promise<number> {
    const input = example.input;
    return input.length / 100;
  }
}

class ContainsKeywordScorer extends ExampleScorer {
  private keyword: string;

  constructor(config: { name: string; keyword: string; threshold?: number }) {
    super({ name: config.name, threshold: config.threshold });
    this.keyword = config.keyword;
  }

  async scoreExample(example: Example): Promise<number> {
    const output = example.actual_output as string;
    return output.toLowerCase().includes(this.keyword.toLowerCase()) ? 1 : 0;
  }
}

async function testLocalScorers() {
  console.log("Testing local scorers...");

  const examples = [
    Example({ input: "Hello", actual_output: "World greeting received" }),
    Example({ input: "Test", actual_output: "Testing in progress" }),
  ];

  const scorers = [
    WordLengthScorer.get({ name: "word_length", threshold: 0.03 }),
    new ContainsKeywordScorer({
      name: "contains_greeting",
      keyword: "greeting",
      threshold: 1.0,
    }),
  ];

  const results = await client.runEvaluation(
    examples,
    scorers,
    "test_project",
    "local_eval_test"
  );

  console.log("Results:", JSON.stringify(results, null, 2));
}

async function testRemoteScorers() {
  console.log("\nTesting remote scorers...");

  const examples = [
    Example({
      input: "What is the capital of France?",
      actual_output: "Paris",
      expected_output: "The capital of France is Paris",
    }),
  ];

  const scorers = [
    AnswerCorrectnessScorer.get({ threshold: 0.7 }),
    AnswerRelevancyScorer.get({ threshold: 0.8 }),
  ];

  const results = await client.runEvaluation(
    examples,
    scorers,
    "test_project",
    "remote_eval_test"
  );

  console.log("Results:", JSON.stringify(results, null, 2));
}

testLocalScorers().catch(console.error);
testRemoteScorers().catch(console.error);
