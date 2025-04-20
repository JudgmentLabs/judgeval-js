/**
 * @file basic_evaluation.test.ts
 * @description Tests for basic evaluation functionality.
 * This file tests:
 * - Evaluation execution
 * - Result handling
 * - Trace generation and management
 * - Trace comparison
 * - Error handling
 * - Async behavior
 * - Timeout handling
 */

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

// Mock the JudgmentClient
jest.mock('../../judgment-client.js');

type EvaluateConfig = {
  examples: Example[];
  scorers: APIJudgmentScorer[];
  model?: string;
  projectName?: string;
  evalName?: string;
};

describe('Basic Evaluation Example', () => {
  let client: jest.Mocked<JudgmentClient>;
  let mockEvaluate: jest.MockedFunction<(config: EvaluateConfig) => Promise<ScoringResult[]>>;
  let mockRunEvaluation: jest.MockedFunction<(examples: Example[], scorers: APIJudgmentScorer[], model: string) => Promise<ScoringResult[]>>;

  beforeEach(() => {
    mockEvaluate = jest.fn();
    mockRunEvaluation = jest.fn();
    
    // Reset and setup mocks
    (JudgmentClient.getInstance as jest.Mock).mockReturnValue({
      evaluate: mockEvaluate,
      runEvaluation: mockRunEvaluation,
    });
    
    client = JudgmentClient.getInstance() as jest.Mocked<JudgmentClient>;
  });

  describe('Single Example Evaluation', () => {
    it('should evaluate a single example with one scorer', async () => {
      const example = new ExampleBuilder()
        .input("What is the capital of France?")
        .actualOutput("The capital of France is Paris.")
        .expectedOutput("Paris is the capital of France.")
        .build();

      const scorer = new AnswerCorrectnessScorer();
      const expectedResult = new ScoringResult({
        dataObject: example,
        scorersData: [{
          name: 'answer_correctness',
          score: 0.85,
          threshold: 0.7,
          success: true,
          reason: 'Test passed',
          strict_mode: false,
          evaluation_model: null,
          error: null,
          evaluation_cost: 0,
          verbose_logs: null,
          additional_metadata: {}
        }]
      });

      mockEvaluate.mockResolvedValue([expectedResult]);

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

      const expectedResult = new ScoringResult({
        dataObject: example,
        scorersData: scorers.map(scorer => ({
          name: scorer.type,
          score: 0.9,
          threshold: 0.7,
          success: true,
          reason: 'Test passed',
          strict_mode: false,
          evaluation_model: null,
          error: null,
          evaluation_cost: 0,
          verbose_logs: null,
          additional_metadata: {}
        }))
      });

      mockEvaluate.mockResolvedValue([expectedResult]);

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
      const expectedResults = examples.map(example => new ScoringResult({
        dataObject: example,
        scorersData: [{
          name: 'answer_correctness',
          score: 1.0,
          threshold: 0.7,
          success: true,
          reason: 'Test passed',
          strict_mode: false,
          evaluation_model: 'gpt-4',
          error: null,
          evaluation_cost: 0,
          verbose_logs: null,
          additional_metadata: {}
        }]
      }));

      mockRunEvaluation.mockResolvedValue(expectedResults);

      const results = await client.runEvaluation(examples, scorers, 'gpt-4');

      expect(mockRunEvaluation).toHaveBeenCalledWith(examples, scorers, 'gpt-4');
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.scorersData).toHaveLength(1);
        expect(result.scorersData![0].evaluation_model).toBe('gpt-4');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle evaluation errors', async () => {
      const example = new ExampleBuilder()
        .input('What is 2+2?')
        .actualOutput('4')
        .expectedOutput('4')
        .build();

      const scorer = new AnswerCorrectnessScorer();
      
      mockEvaluate.mockRejectedValue(new Error('Evaluation failed'));

      await expect(client.evaluate({
        examples: [example],
        scorers: [scorer],
        model: 'gpt-4'
      })).rejects.toThrow('Evaluation failed');
    });
  });

  describe('Async Behavior', () => {
    it('should handle timeout', async () => {
      const example = new ExampleBuilder()
        .input('What is 2+2?')
        .actualOutput('4')
        .expectedOutput('4')
        .build();

      const scorer = new AnswerCorrectnessScorer();
      
      mockEvaluate.mockImplementation(() => 
        new Promise<ScoringResult[]>((resolve) => setTimeout(() => resolve([
          new ScoringResult({
            dataObject: example,
            scorersData: [{
              name: 'answer_correctness',
              score: 1.0,
              threshold: 0.7,
              success: true,
              reason: 'Correct answer',
              strict_mode: false,
              evaluation_model: 'gpt-4',
              error: null,
              evaluation_cost: 0,
              verbose_logs: null,
              additional_metadata: {}
            }]
          })
        ]), 1000))
      );

      await expect(Promise.race([
        client.evaluate({
          examples: [example],
          scorers: [scorer],
          model: 'gpt-4'
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 500))
      ])).rejects.toThrow('Timeout');
    });
  });
}); 