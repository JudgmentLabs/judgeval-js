/**
 * E2E tests for evaluation operations in the JudgmentClient.
 * Migrated from the Python SDK's test_eval_operations.py
 */

import * as dotenv from 'dotenv';
import { JudgmentClient } from '../judgment-client.js';
import { Example, ExampleBuilder } from '../data/example.js';
import {
  FaithfulnessScorer,
  HallucinationScorer,
  AnswerRelevancyScorer,
  JsonCorrectnessScorer
} from '../scorers/api-scorer.js';

// Load environment variables
dotenv.config();

// Generate a random string for test names
const generateRandomString = (length: number = 20): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

describe('Evaluation Operations', () => {
  let client: JudgmentClient;

  beforeAll(() => {
    client = JudgmentClient.getInstance();
  });

  /**
   * Helper function to run evaluation
   */
  const runEvalHelper = async (projectName: string, evalRunName: string) => {
    // Single step in our workflow, an outreach Sales Agent
    const example1 = new ExampleBuilder()
      .input("Generate a cold outreach email for TechCorp. Facts: They recently launched an AI-powered analytics platform. Their CEO Sarah Chen previously worked at Google. They have 50+ enterprise clients.")
      .actualOutput("Dear Ms. Chen,\n\nI noticed TechCorp's recent launch of your AI analytics platform and was impressed by its enterprise-focused approach. Your experience from Google clearly shines through in building scalable solutions, as evidenced by your impressive 50+ enterprise client base.\n\nWould you be open to a brief call to discuss how we could potentially collaborate?\n\nBest regards,\nAlex")
      .retrievalContext(["TechCorp launched AI analytics platform in 2024", "Sarah Chen is CEO, ex-Google executive", "Current client base: 50+ enterprise customers"])
      .build();

    const example2 = new ExampleBuilder()
      .input("Generate a cold outreach email for GreenEnergy Solutions. Facts: They're developing solar panel technology that's 30% more efficient. They're looking to expand into the European market. They won a sustainability award in 2023.")
      .actualOutput("Dear GreenEnergy Solutions team,\n\nCongratulations on your 2023 sustainability award! Your innovative solar panel technology with 30% higher efficiency is exactly what the European market needs right now.\n\nI'd love to discuss how we could support your European expansion plans.\n\nBest regards,\nAlex")
      .expectedOutput("A professional cold email mentioning the sustainability award, solar technology innovation, and European expansion plans")
      .context(["Business Development"])
      .retrievalContext(["GreenEnergy Solutions won 2023 sustainability award", "New solar technology 30% more efficient", "Planning European market expansion"])
      .build();

    const scorer = new FaithfulnessScorer(0.5);
    const scorer2 = new HallucinationScorer(0.5);

    return client.runEvaluation(
      [example1, example2],
      [scorer, scorer2],
      "Qwen/Qwen2.5-72B-Instruct-Turbo",
      undefined,
      { batch: "test" },
      true,
      projectName,
      evalRunName,
      true
    );
  };

  test('Basic evaluation workflow', async () => {
    const PROJECT_NAME = "OutreachWorkflow";
    const EVAL_RUN_NAME = "ColdEmailGenerator-Improve-BasePrompt";

    await runEvalHelper(PROJECT_NAME, EVAL_RUN_NAME);
    const results = await client.pullEval(PROJECT_NAME, EVAL_RUN_NAME);
    expect(results).toBeTruthy();
    expect(results.length).toBeGreaterThan(0);

    // Clean up
    await client.deleteProject(PROJECT_NAME);
  });

  test('Delete evaluation by project and run names', async () => {
    const PROJECT_NAME = generateRandomString();
    const EVAL_RUN_NAMES = Array(3).fill(0).map(() => generateRandomString());

    // Run evaluations with different run names
    for (const evalRunName of EVAL_RUN_NAMES) {
      await runEvalHelper(PROJECT_NAME, evalRunName);
    }

    // Delete evaluations
    await client.deleteEval(PROJECT_NAME, EVAL_RUN_NAMES);
    
    // Delete project
    await client.deleteProject(PROJECT_NAME);
    
    // Verify evaluations are deleted
    for (const evalRunName of EVAL_RUN_NAMES) {
      await expect(client.pullEval(PROJECT_NAME, evalRunName))
        .rejects.toThrow(/Error fetching eval results/);
    }
  });

  test('Delete evaluation by project', async () => {
    const PROJECT_NAME = generateRandomString();
    const EVAL_RUN_NAME = generateRandomString();
    const EVAL_RUN_NAME2 = generateRandomString();

    await runEvalHelper(PROJECT_NAME, EVAL_RUN_NAME);
    await runEvalHelper(PROJECT_NAME, EVAL_RUN_NAME2);

    // Delete project
    await client.deleteProject(PROJECT_NAME);
    
    // Verify evaluations are deleted
    await expect(client.pullEval(PROJECT_NAME, EVAL_RUN_NAME))
      .rejects.toThrow(/Error fetching eval results/);
    
    await expect(client.pullEval(PROJECT_NAME, EVAL_RUN_NAME2))
      .rejects.toThrow(/Error fetching eval results/);
  });

  test('Assert test functionality', async () => {
    // Create examples and scorers
    const example = new ExampleBuilder()
      .input("What if these shoes don't fit?")
      .actualOutput("We offer a 30-day full refund at no extra cost.")
      .retrievalContext(["All customers are eligible for a 30 day full refund at no extra cost."])
      .build();

    const example1 = new ExampleBuilder()
      .input("How much are your croissants?")
      .actualOutput("Sorry, we don't accept electronic returns.")
      .build();

    const example2 = new ExampleBuilder()
      .input("Who is the best basketball player in the world?")
      .actualOutput("No, the room is too small.")
      .build();

    const scorer = new FaithfulnessScorer(0.5);
    const scorer1 = new AnswerRelevancyScorer(0.5);

    const projectName = `test_project_${generateRandomString(8)}`;
    const evalName = `test_eval_${generateRandomString(8)}`;

    try {
      // This should fail with an assertion error
      await expect(client.assertTest(
        [example, example1, example2],
        [scorer, scorer1],
        "Qwen/Qwen2.5-72B-Instruct-Turbo",
        undefined,
        {},
        true,
        projectName,
        evalName,
        true
      )).rejects.toThrow();
    } finally {
      // Clean up resources to prevent leaks
      try {
        await client.deleteProject(projectName);
      } catch (error) {
        console.warn(`Failed to clean up project ${projectName}:`, error);
      }
    }
  }, 120000);

  test('Evaluate dataset', async () => {
    const example1 = new ExampleBuilder()
      .input("What if these shoes don't fit?")
      .actualOutput("We offer a 30-day full refund at no extra cost.")
      .retrievalContext(["All customers are eligible for a 30 day full refund at no extra cost."])
      .build();

    const example2 = new ExampleBuilder()
      .input("How do I reset my password?")
      .actualOutput("You can reset your password by clicking on 'Forgot Password' at the login screen.")
      .expectedOutput("You can reset your password by clicking on 'Forgot Password' at the login screen.")
      .additionalMetadata({ name: "Password Reset", difficulty: "medium" })
      .context(["User Account"])
      .retrievalContext(["Password reset instructions"])
      .toolsCalled(["authentication"])
      .expectedTools(["authentication"])
      .build();

    const projectName = `test_project_${generateRandomString(8)}`;
    const evalName = `test_eval_run_${generateRandomString(8)}`;

    // Use the evaluate method with examples directly
    const res = await client.evaluate({
      examples: [example1, example2],
      scorers: [new FaithfulnessScorer(0.5)],
      model: "Qwen/Qwen2.5-72B-Instruct-Turbo",
      metadata: { batch: "test" },
      projectName,
      evalName
    });
    
    expect(res).toBeTruthy();
    expect(res.length).toBeGreaterThan(0);
    
    // Clean up
    await client.deleteProject(projectName);
  });

  test('Override eval behavior', async () => {
    const example1 = new ExampleBuilder()
      .input("What if these shoes don't fit?")
      .actualOutput("We offer a 30-day full refund at no extra cost.")
      .retrievalContext(["All customers are eligible for a 30 day full refund at no extra cost."])
      .build();
    
    const scorer = new FaithfulnessScorer(0.5);

    const PROJECT_NAME = "test_eval_run_naming_collisions";
    const EVAL_RUN_NAME = generateRandomString();

    // First run should succeed
    await client.runEvaluation(
      [example1],
      [scorer],
      "Qwen/Qwen2.5-72B-Instruct-Turbo",
      undefined,
      { batch: "test" },
      true,
      PROJECT_NAME,
      EVAL_RUN_NAME,
      false  // override=false
    );
    
    // Second run with log_results=false should succeed
    await client.runEvaluation(
      [example1],
      [scorer],
      "Qwen/Qwen2.5-72B-Instruct-Turbo",
      undefined,
      { batch: "test" },
      false,  // log_results=false
      PROJECT_NAME,
      EVAL_RUN_NAME,
      false   // override=false
    );
    
    // Third run with override=true should succeed
    await client.runEvaluation(
      [example1],
      [scorer],
      "Qwen/Qwen2.5-72B-Instruct-Turbo",
      undefined,
      { batch: "test" },
      true,
      PROJECT_NAME,
      EVAL_RUN_NAME,
      true    // override=true
    );
    
    // Fourth run with override=false should fail
    await expect(client.runEvaluation(
      [example1],
      [scorer],
      "Qwen/Qwen2.5-72B-Instruct-Turbo",
      undefined,
      { batch: "test" },
      true,
      PROJECT_NAME,
      EVAL_RUN_NAME,
      false   // override=false
    )).rejects.toThrow();
    
    // Clean up
    await client.deleteProject(PROJECT_NAME);
  });
});

// Advanced evaluation operations tests
describe('Advanced Evaluation Operations', () => {
  let client: JudgmentClient;

  beforeAll(() => {
    client = JudgmentClient.getInstance();
  });

  test('JSON scorer functionality', async () => {
    // Test data for JSON scorer
    const jsonExample = new ExampleBuilder()
      .input("Extract the following information as JSON: Name: John Smith, Age: 35, Occupation: Software Engineer")
      .actualOutput('{"name": "John Smith", "age": 35, "occupation": "Software Engineer"}')
      .expectedOutput('{"name": "John Smith", "age": 35, "occupation": "Software Engineer"}')
      .build();

    const jsonScorer = new JsonCorrectnessScorer(0.8);
    
    const results = await client.evaluate({
      examples: [jsonExample],
      scorers: [jsonScorer],
      model: "Qwen/Qwen2.5-72B-Instruct-Turbo",
      projectName: "json-scorer-test",
      evalName: `json-scorer-${generateRandomString()}`
    });
    
    expect(results).toBeTruthy();
    expect(results.length).toBe(1);
    expect(results[0].scorersData?.length).toBe(1);
    expect(results[0].scorersData?.[0].name).toBe("json_correctness");
  });
});
