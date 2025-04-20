/**
 * Tests for the logger module
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createLogger } from 'winston';
import { 
  debug, 
  info, 
  warning, 
  error, 
  setExampleContext, 
  clearExampleContext, 
  withExampleContext,
  formatEvaluationResults,
  printResults,
  print
} from '../../common/logger';
import logger from '../../common/logger-instance';

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }),
  format: {
    combine: jest.fn().mockReturnValue({}),
    timestamp: jest.fn().mockReturnValue({}),
    printf: jest.fn().mockReturnValue({}),
    colorize: jest.fn().mockReturnValue({})
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

describe('Logger', () => {
  let debugSpy: any;
  let infoSpy: any;
  let warnSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    jest.clearAllMocks();
    debugSpy = jest.spyOn(logger, 'debug');
    infoSpy = jest.spyOn(logger, 'info');
    warnSpy = jest.spyOn(logger, 'warn');
    errorSpy = jest.spyOn(logger, 'error');
  });

  afterEach(() => {
    clearExampleContext();
    jest.restoreAllMocks();
  });

  describe('Logging Functions', () => {
    it('should log debug messages', () => {
      debug('test debug message', { key: 'value' });
      expect(debugSpy).toHaveBeenCalledWith('test debug message', expect.any(Object));
    });

    it('should log info messages', () => {
      info('test info message', { key: 'value' });
      expect(infoSpy).toHaveBeenCalledWith('test info message', expect.any(Object));
    });

    it('should log warning messages', () => {
      warning('test warning message', { key: 'value' });
      expect(warnSpy).toHaveBeenCalledWith('test warning message', expect.any(Object));
    });

    it('should log error messages', () => {
      error('test error message', { key: 'value' });
      expect(errorSpy).toHaveBeenCalledWith('test error message', expect.any(Object));
    });
  });

  describe('Example Context', () => {
    it('should set and clear example context', () => {
      setExampleContext('test-id', '2024-01-01');
      info('test message');
      clearExampleContext();
      expect(infoSpy).toHaveBeenCalledWith('test message', expect.any(Object));
    });

    it('should handle example context in withExampleContext', () => {
      const result = withExampleContext('test-id', '2024-01-01', () => {
        info('test message');
        return 'test result';
      });
      expect(result).toBe('test result');
      expect(infoSpy).toHaveBeenCalledWith('test message', expect.any(Object));
    });
  });

  describe('Result Formatting', () => {
    it('should format empty results', () => {
      const formatted = formatEvaluationResults([]);
      expect(formatted).toBe('');
    });

    it('should format successful results', () => {
      const results = [
        { success: true, example: { input: 'test input' } }
      ];
      const formatted = formatEvaluationResults(results);
      expect(formatted).toContain('Success Rate: 100.00%');
    });

    it('should format failed results', () => {
      const results = [
        { 
          success: false, 
          example: { input: 'test input' },
          scorersData: [
            { name: 'test scorer', success: false, error: 'test error' }
          ]
        }
      ];
      const formatted = formatEvaluationResults(results);
      expect(formatted).toContain('Failures (1)');
      expect(formatted).toContain('test error');
    });
  });

  describe('Print Functions', () => {
    it('should print results with project and eval names', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      printResults([], 'test-project', 'test-eval');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('app.judgmentlabs.ai'));
    });

    it('should print array results', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      print([{ success: true }]);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should print trace data', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      print({ traceId: 'test-id', name: 'test trace' });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Trace: test trace'));
    });

    it('should print workflow analysis results', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      print({
        title: 'Workflow Analysis Results',
        scorerPerformance: [{ name: 'test', score: 1, rating: 'good' }],
        areasForImprovement: ['test area'],
        strengths: ['test strength']
      });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Workflow Analysis Results'));
    });

    it('should print recommendations', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      print({
        title: 'Test Title',
        recommendations: ['test recommendation']
      });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test Title'));
    });

    it('should print other data as JSON', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      print({ test: 'data' });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test'));
    });
  });
}); 