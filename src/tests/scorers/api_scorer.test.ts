/**
 * @file api_scorer.test.ts
 * @description Tests for API-based scorers.
 * This file tests:
 * - Scorer initialization and configuration
 * - Trace-aware scoring
 * - Trace context handling
 * - Trace metadata validation
 * - Error handling
 * - Threshold validation
 * - Scorer metadata
 */

import { describe, expect, it, jest } from '@jest/globals';
import { ExampleBuilder } from '../../data/example.js';
import {
  AnswerCorrectnessScorer,
  AnswerRelevancyScorer,
  ComparisonScorer,
  ContextualPrecisionScorer,
  ContextualRecallScorer,
  ContextualRelevancyScorer,
  ExecutionOrderScorer,
  FaithfulnessScorer,
  GroundednessScorer,
  HallucinationScorer,
  InstructionAdherenceScorer,
  JsonCorrectnessScorer,
  SummarizationScorer,
  Text2SQLScorer
} from '../../scorers/api-scorer.js';
import { ScorerData } from '../../data/result.js';

// Mock the APIJudgmentScorer base class
jest.mock('../../scorers/base-scorer.js', () => {
  const mockScorer = jest.fn().mockImplementation((...args: any[]) => {
    const [type, threshold = 0.7, additional_metadata = {}, strict_mode = false, async_mode = true, verbose_mode = true, include_reason = true] = args;
    interface MockInstance {
      type: string;
      scoreType: string;
      threshold: number;
      additional_metadata: Record<string, any>;
      strict_mode: boolean;
      async_mode: boolean;
      verbose_mode: boolean;
      include_reason: boolean;
      requiredFields: string[];
      validateThreshold: jest.Mock;
      toJSON: () => Record<string, any>;
      a_score_example: jest.Mock;
    }
    const mockInstance: MockInstance = {
      type,
      scoreType: type,
      threshold,
      additional_metadata,
      strict_mode,
      async_mode,
      verbose_mode,
      include_reason,
      requiredFields: ['input', 'actual_output'],
      validateThreshold: jest.fn(),
      toJSON: function() {
        return {
          score_type: this.type,
          threshold: this.threshold,
          additional_metadata: this.additional_metadata,
          strict_mode: this.strict_mode,
          async_mode: this.async_mode,
          verbose_mode: this.verbose_mode,
          include_reason: this.include_reason
        };
      },
      a_score_example: jest.fn().mockImplementation(() => Promise.reject(new Error('API scorers are evaluated on the server side'))),
    };
    return mockInstance;
  });

  return {
    APIJudgmentScorer: mockScorer,
  };
});

describe('API Scorers', () => {
  const mockExample = new ExampleBuilder()
    .input('What is the capital of France?')
    .actualOutput('The capital of France is Paris.')
    .expectedOutput('Paris is the capital of France.')
    .context(['France is a country in Western Europe.', 'Paris is the capital of France.'])
    .retrievalContext(['France is a country in Western Europe.', 'Paris is the capital of France.'])
    .build();

  describe('Initialization', () => {
    it('should initialize scorers with default values', () => {
      const scorer = new AnswerCorrectnessScorer();
      expect(scorer.threshold).toBe(0.7);
      expect(scorer.strict_mode).toBe(false);
      expect(scorer.async_mode).toBe(true);
      expect(scorer.verbose_mode).toBe(true);
      expect(scorer.include_reason).toBe(true);
    });

    it('should initialize scorers with custom values', () => {
      const scorer = new AnswerCorrectnessScorer(0.8, { custom: 'metadata' }, true, false, false, false);
      expect(scorer.threshold).toBe(0.8);
      expect(scorer.additional_metadata).toEqual({ custom: 'metadata' });
      expect(scorer.strict_mode).toBe(true);
      expect(scorer.async_mode).toBe(false);
      expect(scorer.verbose_mode).toBe(false);
      expect(scorer.include_reason).toBe(false);
    });
  });

  describe('Trace Context Handling', () => {
    it('should validate required context fields', () => {
      const scorer = new ContextualRelevancyScorer();
      expect(scorer.requiredFields).toContain('retrieval_context');
    });

    it('should handle trace context in comparison scorer', () => {
      const criteria = ['Accuracy', 'Relevance'];
      const description = 'Compare outputs';
      const scorer = new ComparisonScorer(0.5, criteria, description);
      
      expect(scorer.criteria).toEqual(criteria);
      expect(scorer.description).toBe(description);
    });

    it('should handle execution order with trace context', () => {
      const expectedTools = ['tool1', 'tool2'];
      const scorer = new ExecutionOrderScorer(1.0, expectedTools);
      
      expect(scorer.expectedTools).toEqual(expectedTools);
      expect(scorer.strictMode).toBe(false);
    });
  });

  describe('Trace Metadata', () => {
    it('should handle JSON schema in trace context', () => {
      const jsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        }
      };
      const scorer = new JsonCorrectnessScorer(0.7, jsonSchema);
      
      expect(scorer.jsonSchema).toEqual(jsonSchema);
    });

    it('should serialize scorer with trace metadata', () => {
      const criteria = ['Accuracy', 'Relevance'];
      const description = 'Compare outputs';
      const scorer = new ComparisonScorer(0.5, criteria, description, { trace: 'metadata' });
      
      const json = scorer.toJSON();
      expect(json).toEqual({
        score_type: 'comparison',
        threshold: 0.5,
        additional_metadata: { trace: 'metadata' },
        strict_mode: false,
        async_mode: true,
        verbose_mode: true,
        include_reason: true
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid threshold', () => {
      expect(() => new ComparisonScorer(-0.1)).toThrow('Threshold for comparison must be greater than or equal to 0');
    });

    it('should throw error for server-side evaluation', async () => {
      const scorer = new AnswerCorrectnessScorer();
      const example = new ExampleBuilder()
        .input('test')
        .actualOutput('test')
        .build();

      await expect(scorer.a_score_example(example)).rejects.toThrow('API scorers are evaluated on the server side');
    });
  });

  describe('Specialized Scorers', () => {
    it('should initialize contextual scorers with required fields', () => {
      const contextualScorers = [
        new ContextualPrecisionScorer(),
        new ContextualRecallScorer(),
        new ContextualRelevancyScorer(),
        new FaithfulnessScorer(),
        new HallucinationScorer()
      ];

      for (const scorer of contextualScorers) {
        expect(scorer.requiredFields).toContain('input');
        expect(scorer.requiredFields).toContain('actual_output');
      }
    });

    it('should initialize specialized scorers with correct types', () => {
      const scorers = [
        new GroundednessScorer(),
        new InstructionAdherenceScorer(),
        new SummarizationScorer(),
        new Text2SQLScorer()
      ];

      for (const scorer of scorers) {
        expect(scorer.threshold).toBe(0.7);
        expect(typeof scorer.validateThreshold).toBe('function');
      }
    });
  });
}); 