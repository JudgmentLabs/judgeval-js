/**
 * Logger implementation for the JudgEval TypeScript SDK
 * Based on the Python SDK's logger implementation
 */

import * as fs from 'fs';
import * as path from 'path';
import { format, transports, Logger } from 'winston';
import * as winston from 'winston';

// Define logging state
const LOGGING_STATE = {
  enabled: false,
  path: null as string | null
};

// Track current example info
let currentExampleId: string | null = null;
let currentTimestamp: string | null = null;

// Disable all logging by default
let loggingEnabled = false;

// Define a simple logger interface
interface SimpleLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug: (message: string) => void;
}

/**
 * Enable logging
 * @param namespace The namespace to use for logging
 * @param logDir The directory to store logs in
 */
export function enableLogging(namespace: string = 'judgeval', logDir: string = './logs'): void {
  // Do nothing - we want to keep logging disabled to match Python SDK output format
  loggingEnabled = false;
}

/**
 * Disable logging
 */
export function disableLogging(): void {
  loggingEnabled = false;
}

/**
 * Get the logger instance
 * @returns The logger instance
 */
export function getLogger(): SimpleLogger {
  // Return a dummy logger that does nothing
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };
}

/**
 * Create a logger instance
 * @param namespace The namespace to use for logging
 * @param logDir The directory to store logs in
 * @returns The logger instance
 */
export function createLoggerInstance(namespace: string = 'judgeval', logDir: string = './logs'): SimpleLogger {
  // Return a dummy logger that does nothing
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };
}

/**
 * Check if logging is enabled
 */
function isLoggingEnabled(): boolean {
  return loggingEnabled;
}

/**
 * Log a debug message
 */
export function debug(message: string): void {
  if (isLoggingEnabled()) {
    getLogger().debug(message);
  }
}

/**
 * Log an info message (alias for info)
 */
export function log(message: string, ...args: any[]): void {
  if (isLoggingEnabled()) {
    if (args.length > 0) {
      getLogger().info(`${message} ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')}`);
    } else {
      getLogger().info(message);
    }
  }
}

/**
 * Log an info message
 */
export function info(message: string): void {
  if (isLoggingEnabled()) {
    getLogger().info(message);
  }
}

/**
 * Log a warning message
 */
export function warning(message: string): void {
  if (isLoggingEnabled()) {
    getLogger().warn(message);
  }
}

/**
 * Alias for warning
 */
export function warn(message: string): void {
  warning(message);
}

/**
 * Log an error message
 */
export function error(message: string): void {
  if (isLoggingEnabled()) {
    getLogger().error(message);
  }
}

/**
 * Set the current example context for logging
 */
export function setExampleContext(exampleId: string, timestamp: string): void {
  currentExampleId = exampleId;
  currentTimestamp = timestamp;
}

/**
 * Clear the current example context
 */
export function clearExampleContext(): void {
  currentExampleId = null;
  currentTimestamp = null;
}

/**
 * Create a context for example-specific logging
 */
export function withExampleContext<T>(exampleId: string, timestamp: string, fn: () => T): T {
  try {
    setExampleContext(exampleId, timestamp);
    return fn();
  } finally {
    clearExampleContext();
  }
}

/**
 * Format evaluation results for display
 * This matches the Python SDK's output format with clickable links
 */
export function formatEvaluationResults(results: any[], projectName?: string, evalName?: string): string {
  let output = '';
  
  // Generate a proper URL for viewing results
  const baseUrl = 'https://app.judgmentlabs.ai/app/experiment';
  const urlParams = projectName && evalName ? `?project_name=${projectName}&eval_run_name=${evalName}` : '';
  const resultsUrl = `${baseUrl}${urlParams}`;
  
  // Add the view results URL at the beginning only once
  output += `\n                     \n🔍 You can view your evaluation results here: View Results\n\n`;
  
  // Process each result
  for (const result of results) {
    // Check if this is a failure
    const success = result.success || (result.scorersData?.every((s: any) => s.success) ?? false);
    
    // If the result is not a success, print the failure details
    if (!success) {
      output += '=== Test Failure Details ===\n';
      
      // Get input from either format
      const input = result.dataObject?.input || result.example?.input;
      const actualOutput = result.dataObject?.actualOutput || result.example?.actualOutput;
      const retrievalContext = result.dataObject?.retrievalContext || result.example?.retrievalContext;
      
      output += `Input: ${input}\n`;
      output += `Output: ${actualOutput}\n`;
      output += `Success: False\n`;
      
      if (retrievalContext && retrievalContext.length > 0) {
        output += `Retrieval Context: ${JSON.stringify(retrievalContext)}\n`;
      } else {
        output += 'Retrieval Context: None\n';
      }
      
      // Get scorer data from either format
      const scorersData = result.scorersData || result.scores;
      
      if (scorersData && scorersData.length > 0) {
        output += '\nScorer Details:\n';
        for (const scorer of scorersData) {
          if (!scorer.success) {
            output += `- Name: ${scorer.name}\n`;
            output += `- Score: ${scorer.score}\n`;
            output += `- Threshold: ${scorer.threshold}\n`;
            output += `- Success: False\n`;
            if (scorer.reason) {
              output += `- Reason: ${scorer.reason}\n`;
            }
            output += `- Error: ${scorer.error || 'None'}\n`;
          }
        }
      }
      
      output += '\n';
    }
  }
  
  return output;
}

/**
 * Print evaluation results to the console
 * This matches the Python SDK's output format exactly
 */
export function printResults(results: any[], projectName?: string, evalName?: string): void {
  // Format the results
  const formattedResults = formatEvaluationResults(results, projectName, evalName);
  
  // Print the results to the console directly using console.log
  // This bypasses the Winston logger completely
  process.stdout.write(formattedResults);
  
  // Print raw results for successful evaluations in the same format as Python SDK
  for (const result of results) {
    if (result.success || (result.scorersData?.every((s: any) => s.success) ?? false)) {
      process.stdout.write(`[${JSON.stringify(result)}]\n`);
    }
  }
}

// Export all functions
export default {
  enableLogging,
  disableLogging,
  isLoggingEnabled,
  debug,
  log,
  info,
  warning,
  warn,
  error,
  setExampleContext,
  clearExampleContext,
  withExampleContext,
  formatEvaluationResults,
  printResults
};
