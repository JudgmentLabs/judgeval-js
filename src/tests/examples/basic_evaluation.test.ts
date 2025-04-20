import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { JudgmentClient } from '../../judgment-client.js';
import { ExampleBuilder } from '../../data/example.js';
import { Example } from '../../data/example.js';
import { APIJudgmentScorer } from '../../scorers/base-scorer.js';
import { ScorerData, ScoringResult } from '../../data/result.js';
import {
  AnswerCorrectnessScorer,
  AnswerRelevancyScorer,
  ComparisonScorer,
  ContextualPrecisionScorer,
  ContextualRecallScorer,
  ContextualRelevancyScorer,
  ExecutionOrderScorer,
  FaithfulnessScorer,
  HallucinationScorer,
  InstructionAdherenceScorer,
  JsonCorrectnessScorer,
  SummarizationScorer
} from '../../scorers/api-scorer.js';

// Define types for mock functions
type MockEvaluateConfig = {
  examples: Example[];
  scorers: APIJudgmentScorer[];
  model?: string;
  projectName?: string;
  evalName?: string;
};

// Mock the JudgmentClient
jest.mock('../../judgment-client.js', () => {
  const mockEvaluate = jest.fn();
  const mockRunEvaluation = jest.fn();

  mockEvaluate.mockImplementation((...args: unknown[]) => {
    const config = args[0] as MockEvaluateConfig;
    const { examples, scorers, model = 'gpt-4' } = config;
    return Promise.resolve(examples.map((example: Example) => new ScoringResult({
      dataObject: example,
      scorersData: scorers.map((scorer: APIJudgmentScorer) => ({
        name: scorer.type,
        score: 0.85,
        threshold: scorer.threshold,
        success: true,
        reason: 'Mock evaluation result',
        strict_mode: scorer.strict_mode,
        evaluation_model: model,
        error: null,
        evaluation_cost: 0,
        verbose_logs: null,
        additional_metadata: scorer.additional_metadata || {},
      })),
    })));
  });

  mockRunEvaluation.mockImplementation((...args: unknown[]) => {
    const [examples, scorers, model = 'gpt-4'] = args as [Example[], APIJudgmentScorer[], string];
    return Promise.resolve(examples.map((example: Example) => new ScoringResult({
      dataObject: example,
      scorersData: scorers.map((scorer: APIJudgmentScorer) => ({
        name: scorer.type,
        score: 0.85,
        threshold: scorer.threshold,
        success: true,
        reason: 'Mock evaluation result',
        strict_mode: scorer.strict_mode,
        evaluation_model: model,
        error: null,
        evaluation_cost: 0,
        verbose_logs: null,
        additional_metadata: scorer.additional_metadata || {},
      })),
    })));
  });

  return {
    JudgmentClient: {
      getInstance: jest.fn().mockImplementation(() => ({
        evaluate: mockEvaluate,
        runEvaluation: mockRunEvaluation,
      })),
    },
  };
});

describe('Basic Evaluation Example', () => {
  let client: JudgmentClient;
  let mockEvaluate: jest.Mock;
  let mockRunEvaluation: jest.Mock;

  beforeEach(() => {
    client = JudgmentClient.getInstance();
    mockEvaluate = (client.evaluate as jest.Mock);
    mockRunEvaluation = (client.runEvaluation as jest.Mock);
    jest.clearAllMocks();
  });

  describe('Single Example Evaluation', () => {
    it('should evaluate a single example with one scorer', async () => {
      const example = new ExampleBuilder()
        .input("What is the capital of France?")
        .actualOutput("The capital of France is Paris.")
        .expectedOutput("Paris is the capital of France.")
        .build();

      const scorer = new AnswerCorrectnessScorer();
      const results = await client.evaluate({
        examples: [example],
        scorers: [scorer],
      });

      expect(mockEvaluate).toHaveBeenCalledWith({
        examples: [example],
        scorers: [scorer],
      });
      expect(results).toHaveLength(1);
      expect(results[0].scorersData).toHaveLength(1);
      expect(results[0].scorersData![0].score).toBe(0.85);
      expect(results[0].scorersData![0].success).toBe(true);
      expect(results[0].dataObject).toBe(example);
    });

    it('should evaluate a single example with multiple scorers', async () => {
      const example = new ExampleBuilder()
        .input("Based on the context, what is the capital of France?")
        .actualOutput("According to the context, Paris is the capital of France.")
        .context(["France is a country in Western Europe.", "Paris is the capital of France."])
        .build();

      const scorers = [
        new AnswerCorrectnessScorer(),
        new ContextualRelevancyScorer(),
        new FaithfulnessScorer(),
      ];

      const results = await client.evaluate({
        examples: [example],
        scorers,
      });

      expect(mockEvaluate).toHaveBeenCalledWith({
        examples: [example],
        scorers,
      });
      expect(results).toHaveLength(1);
      expect(results[0].scorersData).toHaveLength(3);
      expect(results[0].dataObject).toBe(example);
    });
  });

  describe('Batch Evaluation', () => {
    it('should evaluate multiple examples in batches', async () => {
      const examples = [
        new ExampleBuilder()
          .input("What is the capital of France?")
          .actualOutput("Paris is the capital of France.")
          .build(),
        new ExampleBuilder()
          .input("What is the capital of Japan?")
          .actualOutput("Tokyo is the capital of Japan.")
          .build(),
        new ExampleBuilder()
          .input("What is the capital of Germany?")
          .actualOutput("Berlin is the capital of Germany.")
          .build(),
      ];

      const scorers = [new AnswerCorrectnessScorer()];
      const results = await client.runEvaluation(examples, scorers, 'gpt-4');

      expect(mockRunEvaluation).toHaveBeenCalledWith(examples, scorers, 'gpt-4');
      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result.scorersData).toHaveLength(1);
        expect(result.scorersData![0].evaluation_model).toBe('gpt-4');
      }
    });
  });

  describe('Advanced Evaluation Scenarios', () => {
    it('should evaluate with custom model and project settings', async () => {
      const example = new ExampleBuilder()
        .input("What is 2+2?")
        .actualOutput("The sum of 2 and 2 is 4.")
        .expectedOutput("4")
        .build();

      const scorer = new AnswerCorrectnessScorer(0.8);
      const results = await client.evaluate({
        examples: [example],
        scorers: [scorer],
        model: 'gpt-4-turbo',
        projectName: 'math-project',
        evalName: 'basic-arithmetic',
      });

      expect(mockEvaluate).toHaveBeenCalledWith({
        examples: [example],
        scorers: [scorer],
        model: 'gpt-4-turbo',
        projectName: 'math-project',
        evalName: 'basic-arithmetic',
      });
      expect(results).toHaveLength(1);
      expect(results[0].scorersData![0].evaluation_model).toBe('gpt-4-turbo');
    });

    it('should evaluate with complex JSON schema validation', async () => {
      const example = new ExampleBuilder()
        .input("Extract person information from: John Doe is 30 years old")
        .actualOutput('{"name": "John Doe", "age": 30}')
        .build();

      const jsonSchema = {
        type: 'object',
        required: ['name', 'age'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        }
      };

      const scorer = new JsonCorrectnessScorer(0.9, jsonSchema);
      const results = await client.evaluate({
        examples: [example],
        scorers: [scorer],
      });

      expect(mockEvaluate).toHaveBeenCalledWith({
        examples: [example],
        scorers: [scorer],
      });
      expect(results).toHaveLength(1);
      expect(results[0].scorersData![0].success).toBe(true);
    });

    it('should evaluate with comparison criteria', async () => {
      const example = new ExampleBuilder()
        .input("Summarize the benefits of exercise")
        .actualOutput("Exercise improves health, mood, and longevity.")
        .expectedOutput("Regular exercise enhances physical health, mental wellbeing, and increases life expectancy.")
        .build();

      const criteria = ['Accuracy', 'Conciseness', 'Completeness'];
      const scorer = new ComparisonScorer(0.7, criteria, 'Compare summary quality');
      const results = await client.evaluate({
        examples: [example],
        scorers: [scorer],
      });

      expect(mockEvaluate).toHaveBeenCalledWith({
        examples: [example],
        scorers: [scorer],
      });
      expect(results).toHaveLength(1);
      expect(results[0].scorersData![0].score).toBeGreaterThanOrEqual(0);
      expect(results[0].scorersData![0].score).toBeLessThanOrEqual(1);
    });
  });
}); 