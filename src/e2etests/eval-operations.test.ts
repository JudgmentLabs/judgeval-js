/**
 * E2E tests for evaluation operations in the JudgmentClient.
 * Migrated from the Python SDK's test_eval_operations.py
 */

import * as dotenv from 'dotenv';
import { JudgmentClient } from '../judgment-client.js';
import { Example, ExampleBuilder } from '../data/example.js';
import { AnswerRelevancyScorer } from '../scorers/api-scorer.js';
import axios from 'axios';
import { APIScorer } from '../constants.js';
import { ScorerWrapper } from '../scorers/base-scorer.js';

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

describe('E2E Evaluation Operations', () => {
  let client: JudgmentClient;
  const TEST_MODEL = "meta-llama/Meta-Llama-3-8B-Instruct-Turbo";

  beforeAll(() => {
    client = JudgmentClient.getInstance();
  });

  test('Basic evaluation workflow', async () => {
    const projectName = `test_project_${generateRandomString(8)}`;
    const evalRunName = `test_eval_${generateRandomString(8)}`;

    try {
      // Create a real example with all fields
      const example = new ExampleBuilder()
        .input("What is the capital of France?")
        .actualOutput("The capital of France is Paris.")
        .expectedOutput("Paris is the capital of France.")
        .context(["France is a country in Western Europe."])
        .retrievalContext(["Paris is the capital of France."])
        .additionalMetadata({source: "test"})
        .name("capital-question")
        .build();

      // Run evaluation
      const evalResults = await client.evaluate({
        examples: [example],
        scorers: [new AnswerRelevancyScorer(0.7, undefined, true, true, true, true)],
        projectName: projectName,
        evalName: evalRunName,
        model: TEST_MODEL
      });

      // Verify evaluation results
      expect(evalResults).toBeTruthy();
      expect(evalResults.length).toBe(1);
      expect(evalResults[0].scorersData?.length).toBe(1);
      expect(evalResults[0].scorersData?.[0].name).toBe("Answer Relevancy");

      // Pull results and verify
      const pulledResults = await client.pullEval(projectName, evalRunName);
      expect(pulledResults).toBeTruthy();
      expect(pulledResults.length).toBe(1);
    } finally {
      try {
        await client.deleteProject(projectName);
      } catch (error) {
        console.warn(`Failed to cleanup project ${projectName}:`, error);
      }
    }
  }, 30000);

  test('Delete evaluation by project and run names', async () => {
    const projectName = `test_project_${generateRandomString(8)}`;
    const evalRunNames = [
      `test_eval_${generateRandomString(8)}`,
      `test_eval_${generateRandomString(8)}`,
      `test_eval_${generateRandomString(8)}`
    ];

    try {
      // Create and run evaluations
      for (const evalRunName of evalRunNames) {
        const example = new ExampleBuilder()
          .input("What is the capital of France?")
          .actualOutput("The capital of France is Paris.")
          .expectedOutput("Paris is the capital of France.")
          .context(["France is a country in Western Europe."])
          .name("capital-question")
          .build();

        await client.evaluate({
          examples: [example],
          scorers: [new AnswerRelevancyScorer(0.7, undefined, true, true, true, true)],
          projectName: projectName,
          evalName: evalRunName,
          model: TEST_MODEL
        });

        // Verify evaluation was created
        const results = await client.pullEval(projectName, evalRunName);
        expect(results).toBeTruthy();
        expect(results.length).toBe(1);
      }

      // Instead of deleting individual evals, delete the whole project
      await client.deleteProject(projectName);

      // Verify evaluations are deleted by trying to pull them
      for (const evalRunName of evalRunNames) {
        try {
          await client.pullEval(projectName, evalRunName);
          fail('Expected pullEval to fail after project deletion');
        } catch (error) {
          expect(error).toBeTruthy();
        }
      }
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  }, 60000);
});
