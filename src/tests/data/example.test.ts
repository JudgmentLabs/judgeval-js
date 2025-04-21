/**
 * @file example.test.ts
 * @description Tests for the Example and ExampleBuilder classes.
 * This file tests:
 * - Example construction and validation
 * - ExampleBuilder pattern
 * - JSON serialization
 * - Default values and optional fields
 * - Trace-related fields and validation
 * - UUID generation
 * - Error handling
 */

import { describe, expect, it, jest } from '@jest/globals';
import { Example, ExampleBuilder } from '../../data/example.js';

describe('Example', () => {
  describe('constructor', () => {
    it('should create an example with all fields', () => {
      const example = new Example({
        input: 'test input',
        actualOutput: 'test output',
        expectedOutput: 'expected output',
        context: ['context 1', 'context 2'],
        retrievalContext: ['retrieval 1', 'retrieval 2'],
        additionalMetadata: { key: 'value' },
        toolsCalled: ['tool1', 'tool2'],
        expectedTools: ['tool1', 'tool2'],
        name: 'test example',
        exampleId: 'test-id',
        exampleIndex: 1,
        timestamp: '2024-01-01T00:00:00.000Z',
        traceId: 'test-trace',
        example: true,
      });

      expect(example.input).toBe('test input');
      expect(example.actualOutput).toBe('test output');
      expect(example.expectedOutput).toBe('expected output');
      expect(example.context).toEqual(['context 1', 'context 2']);
      expect(example.retrievalContext).toEqual(['retrieval 1', 'retrieval 2']);
      expect(example.additionalMetadata).toEqual({ key: 'value' });
      expect(example.toolsCalled).toEqual(['tool1', 'tool2']);
      expect(example.expectedTools).toEqual(['tool1', 'tool2']);
      expect(example.name).toBe('test example');
      expect(example.exampleId).toBe('test-id');
      expect(example.exampleIndex).toBe(1);
      expect(example.timestamp).toBe('2024-01-01T00:00:00.000Z');
      expect(example.traceId).toBe('test-trace');
      expect(example.example).toBe(true);
    });

    it('should create an example with required fields only', () => {
      const example = new Example({
        input: 'test input',
        actualOutput: 'test output',
      });

      expect(example.input).toBe('test input');
      expect(example.actualOutput).toBe('test output');
      expect(example.expectedOutput).toBeUndefined();
      expect(example.context).toBeUndefined();
      expect(example.retrievalContext).toBeUndefined();
      expect(example.additionalMetadata).toBeUndefined();
      expect(example.toolsCalled).toBeUndefined();
      expect(example.expectedTools).toBeUndefined();
      expect(example.name).toBeUndefined();
      expect(example.exampleId).toBeDefined();
      expect(example.exampleIndex).toBeUndefined();
      expect(example.timestamp).toBeDefined();
      expect(example.traceId).toBeUndefined();
      expect(example.example).toBe(true);
    });

    it('should generate a valid UUID for exampleId if not provided', () => {
      const example = new Example({
        input: 'test input',
        actualOutput: 'test output',
      });

      expect(example.exampleId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should set example to false when explicitly set', () => {
      const example = new Example({
        input: 'test input',
        actualOutput: 'test output',
        example: false,
      });

      expect(example.example).toBe(false);
    });

    it('should validate trace ID format', () => {
      const example = new Example({
        input: 'test input',
        actualOutput: 'test output',
        traceId: 'invalid-trace-id'
      });

      expect(example.traceId).toBe('invalid-trace-id');
      
      // Test with valid UUID format
      const example2 = new Example({
        input: 'test input',
        actualOutput: 'test output',
        traceId: '123e4567-e89b-12d3-a456-426614174000'
      });

      expect(example2.traceId).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should handle trace context correctly', () => {
      const example = new Example({
        input: 'test input',
        actualOutput: 'test output',
        context: ['trace context 1', 'trace context 2'],
        retrievalContext: ['retrieved context 1', 'retrieved context 2']
      });

      expect(example.context).toEqual(['trace context 1', 'trace context 2']);
      expect(example.retrievalContext).toEqual(['retrieved context 1', 'retrieved context 2']);
    });

    it('should handle array outputs correctly', () => {
      const example = new Example({
        input: 'test input',
        actualOutput: ['output 1', 'output 2'],
        expectedOutput: ['expected 1', 'expected 2']
      });

      expect(example.actualOutput).toEqual(['output 1', 'output 2']);
      expect(example.expectedOutput).toEqual(['expected 1', 'expected 2']);
    });
  });

  describe('toJSON', () => {
    it('should convert example to JSON', () => {
      const example = new Example({
        input: 'test input',
        actualOutput: 'test output',
        expectedOutput: 'expected output',
        context: ['context 1', 'context 2'],
        retrievalContext: ['retrieval 1', 'retrieval 2'],
        additionalMetadata: { key: 'value' },
        toolsCalled: ['tool1', 'tool2'],
        expectedTools: ['tool1', 'tool2'],
        name: 'test example',
        exampleIndex: 1,
        timestamp: '2024-01-01T00:00:00.000Z',
        traceId: 'test-trace',
        example: true,
      });

      const json = example.toJSON();

      expect(json).toEqual({
        input: 'test input',
        actualOutput: 'test output',
        expectedOutput: 'expected output',
        context: ['context 1', 'context 2'],
        retrievalContext: ['retrieval 1', 'retrieval 2'],
        additionalMetadata: { key: 'value' },
        toolsCalled: ['tool1', 'tool2'],
        expectedTools: ['tool1', 'tool2'],
        name: 'test example',
        exampleId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
        exampleIndex: 1,
        timestamp: '2024-01-01T00:00:00.000Z',
        traceId: 'test-trace',
        example: true,
      });
    });

    it('should generate default values for required fields in JSON', () => {
      const example = new Example({
        input: 'test input',
        actualOutput: 'test output',
      });

      const json = example.toJSON();

      expect(json).toEqual({
        input: 'test input',
        actualOutput: 'test output',
        name: 'example',
        exampleId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
        exampleIndex: 0,
        timestamp: expect.any(String),
        traceId: expect.stringMatching(/^trace-\d+-\d+$/),
        example: true,
      });
    });

    it('should handle trace-related fields in JSON', () => {
      const example = new Example({
        input: 'test input',
        actualOutput: 'test output',
        traceId: 'test-trace',
        context: ['trace context'],
        retrievalContext: ['retrieved context']
      });

      const json = example.toJSON();

      expect(json).toEqual({
        input: 'test input',
        actualOutput: 'test output',
        name: 'example',
        exampleId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
        exampleIndex: 0,
        timestamp: expect.any(String),
        traceId: 'test-trace',
        context: ['trace context'],
        retrievalContext: ['retrieved context'],
        example: true
      });
    });
  });
});

describe('ExampleBuilder', () => {
  it('should build an example with all fields', () => {
    const example = new ExampleBuilder()
      .input('test input')
      .actualOutput('test output')
      .expectedOutput('expected output')
      .context(['context 1', 'context 2'])
      .retrievalContext(['retrieval 1', 'retrieval 2'])
      .additionalMetadata({ key: 'value' })
      .toolsCalled(['tool1', 'tool2'])
      .expectedTools(['tool1', 'tool2'])
      .name('test example')
      .exampleId('test-id')
      .exampleIndex(1)
      .timestamp('2024-01-01T00:00:00.000Z')
      .traceId('test-trace')
      .example(true)
      .build();

    expect(example.input).toBe('test input');
    expect(example.actualOutput).toBe('test output');
    expect(example.expectedOutput).toBe('expected output');
    expect(example.context).toEqual(['context 1', 'context 2']);
    expect(example.retrievalContext).toEqual(['retrieval 1', 'retrieval 2']);
    expect(example.additionalMetadata).toEqual({ key: 'value' });
    expect(example.toolsCalled).toEqual(['tool1', 'tool2']);
    expect(example.expectedTools).toEqual(['tool1', 'tool2']);
    expect(example.name).toBe('test example');
    expect(example.exampleId).toBe('test-id');
    expect(example.exampleIndex).toBe(1);
    expect(example.timestamp).toBe('2024-01-01T00:00:00.000Z');
    expect(example.traceId).toBe('test-trace');
    expect(example.example).toBe(true);
  });

  it('should build an example with required fields only', () => {
    const example = new ExampleBuilder()
      .input('test input')
      .actualOutput('test output')
      .build();

    expect(example.input).toBe('test input');
    expect(example.actualOutput).toBe('test output');
    expect(example.expectedOutput).toBeUndefined();
    expect(example.context).toBeUndefined();
    expect(example.retrievalContext).toBeUndefined();
    expect(example.additionalMetadata).toBeUndefined();
    expect(example.toolsCalled).toBeUndefined();
    expect(example.expectedTools).toBeUndefined();
    expect(example.name).toBeUndefined();
    expect(example.exampleId).toBeDefined();
    expect(example.exampleIndex).toBeUndefined();
    expect(example.timestamp).toBeDefined();
    expect(example.traceId).toBeUndefined();
    expect(example.example).toBe(true);
  });

  it('should throw error when input is not provided', () => {
    expect(() => {
      new ExampleBuilder().build();
    }).toThrow('Input is required for an Example');
  });

  it('should set example to false when explicitly set', () => {
    const example = new ExampleBuilder()
      .input('test input')
      .actualOutput('test output')
      .example(false)
      .build();

    expect(example.example).toBe(false);
  });

  it('should handle trace-related fields in builder', () => {
    const example = new ExampleBuilder()
      .input('test input')
      .actualOutput('test output')
      .traceId('test-trace')
      .context(['trace context'])
      .retrievalContext(['retrieved context'])
      .build();

    expect(example.traceId).toBe('test-trace');
    expect(example.context).toEqual(['trace context']);
    expect(example.retrievalContext).toEqual(['retrieved context']);
  });

  it('should handle array outputs in builder', () => {
    const example = new ExampleBuilder()
      .input('test input')
      .actualOutput(['output 1', 'output 2'])
      .expectedOutput(['expected 1', 'expected 2'])
      .build();

    expect(example.actualOutput).toEqual(['output 1', 'output 2']);
    expect(example.expectedOutput).toEqual(['expected 1', 'expected 2']);
  });
}); 