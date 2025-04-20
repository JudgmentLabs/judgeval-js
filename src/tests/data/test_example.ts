import { describe, expect, it } from '@jest/globals';
import { ExampleBuilder } from '../../data/example.js';

describe('Example', () => {
  describe('ExampleBuilder', () => {
    it('should build example with all fields', () => {
      const example = new ExampleBuilder()
        .input('What is the capital of France?')
        .actualOutput('The capital of France is Paris.')
        .expectedOutput('Paris is the capital of France.')
        .context(['France is a country in Western Europe.', 'Paris is the capital of France.'])
        .retrievalContext(['France is a country in Western Europe.', 'Paris is the capital of France.'])
        .build();

      expect(example.input).toBe('What is the capital of France?');
      expect(example.actualOutput).toBe('The capital of France is Paris.');
      expect(example.expectedOutput).toBe('Paris is the capital of France.');
      expect(example.context).toEqual(['France is a country in Western Europe.', 'Paris is the capital of France.']);
      expect(example.retrievalContext).toEqual(['France is a country in Western Europe.', 'Paris is the capital of France.']);
    });

    it('should build example with minimal fields', () => {
      const example = new ExampleBuilder()
        .input('What is the capital of France?')
        .actualOutput('The capital of France is Paris.')
        .build();

      expect(example.input).toBe('What is the capital of France?');
      expect(example.actualOutput).toBe('The capital of France is Paris.');
      expect(example.expectedOutput).toBeUndefined();
      expect(example.context).toBeUndefined();
      expect(example.retrievalContext).toBeUndefined();
    });

    it('should handle optional fields', () => {
      const example = new ExampleBuilder()
        .input('What is the capital of France?')
        .actualOutput('The capital of France is Paris.')
        .build();

      expect(example.input).toBe('What is the capital of France?');
      expect(example.actualOutput).toBe('The capital of France is Paris.');
      expect(example.expectedOutput).toBeUndefined();
      expect(example.context).toBeUndefined();
      expect(example.retrievalContext).toBeUndefined();
    });
  });
}); 