import { describe, expect, it, jest } from '@jest/globals';
import { Example, ExampleBuilder } from '../../data/example';

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
}); 