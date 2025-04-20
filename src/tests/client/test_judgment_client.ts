import { describe, expect, it } from '@jest/globals';
import { JudgmentClient } from '../../judgment-client.js';
import { ExampleBuilder } from '../../data/example.js';
import { AnswerCorrectnessScorer } from '../../scorers/api-scorer.js';
import { ScoringResult } from '../../data/result.js';

describe('JudgmentClient', () => {
  const client = new JudgmentClient('test-api-key');

  describe('evaluate', () => {
    it('should evaluate a single example', async () => {
      const example = new ExampleBuilder()
        .input('What is the capital of France?')
        .actualOutput('The capital of France is Paris.')
        .expectedOutput('Paris is the capital of France.')
        .build();

      const scorer = new AnswerCorrectnessScorer();

      const results = await client.evaluate({
        examples: [example],
        scorers: [scorer],
        model: 'gpt-4',
        projectName: 'test-project',
        evalName: 'test-eval'
      });

      expect(results).toBeDefined();
      expect(results.length).toBe(1);
      const result = results[0];
      expect(result.dataObject).toBeDefined();
      expect(result.scorersData).toBeDefined();
      expect(result.scorersData?.length).toBe(1);
      expect(result.scorersData?.[0].score).toBeDefined();
      expect(result.scorersData?.[0].reason).toBeDefined();
    });

    it('should evaluate multiple examples', async () => {
      const examples = [
        new ExampleBuilder()
          .input('What is the capital of France?')
          .actualOutput('The capital of France is Paris.')
          .expectedOutput('Paris is the capital of France.')
          .build(),
        new ExampleBuilder()
          .input('What is the capital of Germany?')
          .actualOutput('The capital of Germany is Berlin.')
          .expectedOutput('Berlin is the capital of Germany.')
          .build(),
      ];

      const scorer = new AnswerCorrectnessScorer();

      const results = await client.evaluate({
        examples,
        scorers: [scorer],
        model: 'gpt-4',
        projectName: 'test-project',
        evalName: 'test-eval'
      });

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.dataObject).toBeDefined();
        expect(result.scorersData).toBeDefined();
        expect(result.scorersData?.length).toBe(1);
        expect(result.scorersData?.[0].score).toBeDefined();
        expect(result.scorersData?.[0].reason).toBeDefined();
      });
    });
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = JudgmentClient.getInstance();
      const instance2 = JudgmentClient.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('evaluate', () => {
    it('should throw error when API key is not set', async () => {
      const example = new ExampleBuilder()
        .input('What is the capital of France?')
        .actualOutput('The capital of France is Paris.')
        .build();

      const scorer = new AnswerCorrectnessScorer();

      await expect(client.evaluate({
        examples: [example],
        scorers: [scorer],
        evalName: 'test-eval',
        projectName: 'test-project',
        model: 'test-model'
      })).rejects.toThrow('API key is not set');
    });

    it('should throw error when required parameters are missing', async () => {
      const example = new ExampleBuilder()
        .input('What is the capital of France?')
        .actualOutput('The capital of France is Paris.')
        .build();

      const scorer = new AnswerCorrectnessScorer();

      await expect(client.evaluate({
        examples: [example],
        scorers: [scorer]
      } as any)).rejects.toThrow('Missing required parameters');
    });
  });
}); 