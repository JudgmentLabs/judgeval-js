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
    return {
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
      toJSON: jest.fn().mockReturnValue({}),
      a_score_example: jest.fn().mockImplementation(() => Promise.reject(new Error('API scorers are evaluated on the server side'))),
    };
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

  describe('AnswerCorrectnessScorer', () => {
    it('should initialize with default parameters', () => {
      const scorer = new AnswerCorrectnessScorer();
      expect(scorer.threshold).toBe(0.7);
      expect(scorer.strict_mode).toBe(false);
      expect(scorer.async_mode).toBe(true);
      expect(scorer.verbose_mode).toBe(true);
      expect(scorer.include_reason).toBe(true);
    });

    it('should initialize with custom parameters', () => {
      const scorer = new AnswerCorrectnessScorer(0.8, { custom: 'metadata' }, true, false, false, false);
      expect(scorer.threshold).toBe(0.8);
      expect(scorer.additional_metadata).toEqual({ custom: 'metadata' });
      expect(scorer.strict_mode).toBe(true);
      expect(scorer.async_mode).toBe(false);
      expect(scorer.verbose_mode).toBe(false);
      expect(scorer.include_reason).toBe(false);
    });

    it('should throw error when scoring locally', async () => {
      const scorer = new AnswerCorrectnessScorer();
      await expect(scorer.a_score_example(mockExample)).rejects.toThrow('API scorers are evaluated on the server side');
    });
  });

  describe('AnswerRelevancyScorer', () => {
    it('should initialize with default parameters', () => {
      const scorer = new AnswerRelevancyScorer();
      expect(scorer.threshold).toBe(0.7);
    });

    it('should throw error when scoring locally', async () => {
      const scorer = new AnswerRelevancyScorer();
      await expect(scorer.a_score_example(mockExample)).rejects.toThrow('API scorers are evaluated on the server side');
    });
  });

  describe('ComparisonScorer', () => {
    it('should initialize with default parameters', () => {
      const scorer = new ComparisonScorer();
      expect(scorer.threshold).toBe(0.5);
      expect(scorer.criteria).toEqual(['Accuracy', 'Helpfulness', 'Relevance']);
      expect(scorer.description).toBe('Compare the outputs based on the given criteria');
    });

    it('should initialize with custom parameters', () => {
      const customCriteria = ['Clarity', 'Completeness'];
      const customDescription = 'Custom comparison criteria';
      const scorer = new ComparisonScorer(0.6, customCriteria, customDescription);
      expect(scorer.threshold).toBe(0.6);
      expect(scorer.criteria).toEqual(customCriteria);
      expect(scorer.description).toBe(customDescription);
    });

    it('should throw error when scoring locally', async () => {
      const scorer = new ComparisonScorer();
      await expect(scorer.a_score_example(mockExample)).rejects.toThrow('API scorers are evaluated on the server side');
    });
  });

  describe('ContextualPrecisionScorer', () => {
    it('should initialize with default parameters', () => {
      const scorer = new ContextualPrecisionScorer();
      expect(scorer.threshold).toBe(0.7);
      expect(scorer.requiredFields).toEqual(['input', 'actual_output', 'context']);
    });

    it('should throw error when scoring locally', async () => {
      const scorer = new ContextualPrecisionScorer();
      await expect(scorer.a_score_example(mockExample)).rejects.toThrow('API scorers are evaluated on the server side');
    });
  });

  describe('ContextualRecallScorer', () => {
    it('should initialize with default parameters', () => {
      const scorer = new ContextualRecallScorer();
      expect(scorer.threshold).toBe(0.7);
      expect(scorer.requiredFields).toEqual(['input', 'actual_output', 'context']);
    });

    it('should throw error when scoring locally', async () => {
      const scorer = new ContextualRecallScorer();
      await expect(scorer.a_score_example(mockExample)).rejects.toThrow('API scorers are evaluated on the server side');
    });
  });

  describe('ContextualRelevancyScorer', () => {
    it('should initialize with default parameters', () => {
      const scorer = new ContextualRelevancyScorer();
      expect(scorer.threshold).toBe(0.7);
      expect(scorer.requiredFields).toEqual(['input', 'actual_output', 'retrieval_context']);
    });

    it('should throw error when scoring locally', async () => {
      const scorer = new ContextualRelevancyScorer();
      await expect(scorer.a_score_example(mockExample)).rejects.toThrow('API scorers are evaluated on the server side');
    });
  });

  describe('ExecutionOrderScorer', () => {
    it('should initialize with default parameters', () => {
      const scorer = new ExecutionOrderScorer();
      expect(scorer.threshold).toBe(1.0);
      expect(scorer.strictMode).toBe(false);
      expect(scorer.expectedTools).toBeUndefined();
    });

    it('should initialize with custom parameters', () => {
      const expectedTools = ['tool1', 'tool2'];
      const scorer = new ExecutionOrderScorer(0.9, expectedTools, { custom: 'metadata' }, true);
      expect(scorer.threshold).toBe(0.9);
      expect(scorer.expectedTools).toEqual(expectedTools);
      expect(scorer.strictMode).toBe(true);
    });

    it('should throw error when scoring locally', async () => {
      const scorer = new ExecutionOrderScorer();
      await expect(scorer.a_score_example(mockExample)).rejects.toThrow('API scorers are evaluated on the server side');
    });
  });

  describe('FaithfulnessScorer', () => {
    it('should initialize with default parameters', () => {
      const scorer = new FaithfulnessScorer();
      expect(scorer.threshold).toBe(0.7);
      expect(scorer.requiredFields).toEqual(['input', 'actual_output', 'context']);
    });

    it('should throw error when scoring locally', async () => {
      const scorer = new FaithfulnessScorer();
      await expect(scorer.a_score_example(mockExample)).rejects.toThrow('API scorers are evaluated on the server side');
    });
  });

  describe('HallucinationScorer', () => {
    it('should initialize with default parameters', () => {
      const scorer = new HallucinationScorer();
      expect(scorer.threshold).toBe(0.7);
      expect(scorer.requiredFields).toEqual(['input', 'actual_output', 'context']);
    });

    it('should throw error when scoring locally', async () => {
      const scorer = new HallucinationScorer();
      await expect(scorer.a_score_example(mockExample)).rejects.toThrow('API scorers are evaluated on the server side');
    });
  });

  describe('InstructionAdherenceScorer', () => {
    it('should initialize with default parameters', () => {
      const scorer = new InstructionAdherenceScorer();
      expect(scorer.threshold).toBe(0.7);
    });

    it('should throw error when scoring locally', async () => {
      const scorer = new InstructionAdherenceScorer();
      await expect(scorer.a_score_example(mockExample)).rejects.toThrow('API scorers are evaluated on the server side');
    });
  });

  describe('JsonCorrectnessScorer', () => {
    it('should initialize with default parameters', () => {
      const scorer = new JsonCorrectnessScorer();
      expect(scorer.threshold).toBe(0.7);
      expect(scorer.jsonSchema).toBeUndefined();
    });

    it('should initialize with custom parameters', () => {
      const jsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        }
      };
      const scorer = new JsonCorrectnessScorer(0.8, jsonSchema);
      expect(scorer.threshold).toBe(0.8);
      expect(scorer.jsonSchema).toEqual(jsonSchema);
    });

    it('should throw error when scoring locally', async () => {
      const scorer = new JsonCorrectnessScorer();
      await expect(scorer.a_score_example(mockExample)).rejects.toThrow('API scorers are evaluated on the server side');
    });
  });

  describe('SummarizationScorer', () => {
    it('should initialize with default parameters', () => {
      const scorer = new SummarizationScorer();
      expect(scorer.threshold).toBe(0.7);
    });

    it('should throw error when scoring locally', async () => {
      const scorer = new SummarizationScorer();
      await expect(scorer.a_score_example(mockExample)).rejects.toThrow('API scorers are evaluated on the server side');
    });
  });

  describe('Text2SQLScorer', () => {
    it('should initialize with default parameters', () => {
      const scorer = new Text2SQLScorer();
      expect(scorer.threshold).toBe(0.7);
    });

    it('should throw error when scoring locally', async () => {
      const scorer = new Text2SQLScorer();
      await expect(scorer.a_score_example(mockExample)).rejects.toThrow('API scorers are evaluated on the server side');
    });
  });
}); 