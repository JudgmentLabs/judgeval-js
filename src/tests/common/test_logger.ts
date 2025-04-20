import * as logger from '../../common/logger.js';

describe('Logger', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let logOutput: string[] = [];
  let errorOutput: string[] = [];

  beforeEach(() => {
    // Store original console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    // Mock console methods
    console.log = (...args) => {
      logOutput.push(args.join(' '));
    };
    console.error = (...args) => {
      errorOutput.push(args.join(' '));
    };

    // Clear output arrays
    logOutput = [];
    errorOutput = [];
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('print', () => {
    it('should print object to console', () => {
      const testObject = { key: 'value' };
      logger.print(testObject);
      expect(logOutput[0]).toContain('key');
      expect(logOutput[0]).toContain('value');
    });

    it('should print string to console', () => {
      const testString = 'Test message';
      logger.print(testString);
      expect(logOutput[0]).toBe(testString);
    });
  });

  describe('error', () => {
    it('should print error to console', () => {
      const errorMessage = 'Test error';
      logger.error(errorMessage);
      expect(errorOutput[0]).toBe(errorMessage);
    });
  });
}); 