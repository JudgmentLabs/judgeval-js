/**
 * Logger implementation for the JudgEval TypeScript SDK
 * Based on the Python SDK's logger implementation
 */

import * as fs from 'fs';
import * as path from 'path';

// Define logging state
class LoggingState {
  enabled: boolean = false;
  path: string | null = null;
}

const LOGGING_STATE = new LoggingState();

// Track current example info
let currentExampleId: string | null = null;
let currentTimestamp: string | null = null;

// Define a simple logger interface
interface SimpleLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug: (message: string) => void;
}

// Create a simple logger that writes to console
const logger: SimpleLogger = {
  debug: (message: string) => {
    if (LOGGING_STATE.enabled) {
      console.debug(`[DEBUG] ${message}`);
    }
  },
  info: (message: string) => {
    if (LOGGING_STATE.enabled) {
      console.info(`[INFO] ${message}`);
    }
  },
  warn: (message: string) => {
    if (LOGGING_STATE.enabled) {
      console.warn(`[WARN] ${message}`);
    }
  },
  error: (message: string) => {
    if (LOGGING_STATE.enabled) {
      console.error(`[ERROR] ${message}`);
    }
  }
};

/**
 * Enable logging
 * @param name The namespace to use for logging
 * @param logDir The directory to store logs in
 */
export function enableLogging(name: string = 'judgeval', logDir: string = './logs'): void {
  LOGGING_STATE.enabled = true;
  LOGGING_STATE.path = logDir;
  
  // Create log directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  logger.info("Logging enabled");
}

/**
 * Disable logging
 */
export function disableLogging(): void {
  if (LOGGING_STATE.enabled) {
    logger.info("Logging disabled");
  }
  LOGGING_STATE.enabled = false;
}

/**
 * Check if logging is enabled
 */
export function isLoggingEnabled(): boolean {
  return LOGGING_STATE.enabled;
}

/**
 * Log a debug message
 */
export function debug(message: string): void {
  logger.debug(message);
}

/**
 * Log an info message (alias for info)
 */
export function log(message: string, ...args: any[]): void {
  if (args.length > 0) {
    const formattedArgs = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ');
    logger.info(`${message} ${formattedArgs}`);
  } else {
    logger.info(message);
  }
}

/**
 * Log an info message
 */
export function info(message: string): void {
  logger.info(message);
}

/**
 * Log a warning message
 */
export function warning(message: string): void {
  logger.warn(message);
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
  logger.error(message);
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
  setExampleContext(exampleId, timestamp);
  try {
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
  
  // Print summary information
  if (results.length > 0) {
    output += `\n=== Evaluation Results (${results.length} examples) ===\n\n`;
    
    // Calculate success rate
    const successfulExamples = results.filter(r => 
      r.success || (r.scorersData?.every((s: any) => s.success) ?? false)
    ).length;
    
    const successRate = (successfulExamples / results.length) * 100;
    output += `Success Rate: ${successRate.toFixed(2)}% (${successfulExamples}/${results.length})\n\n`;
    
    // Print failures if any
    const failures = results.filter(r => 
      !r.success || (r.scorersData?.some((s: any) => !s.success) ?? false)
    );
    
    if (failures.length > 0) {
      output += `Failures (${failures.length}):\n`;
      
      for (const [index, failure] of failures.entries()) {
        output += `\nExample ${index + 1}:\n`;
        output += `Input: ${failure.example?.input || 'N/A'}\n`;
        
        if (failure.scorersData) {
          output += 'Scorer Failures:\n';
          
          for (const scorer of failure.scorersData) {
            if (!scorer.success) {
              output += `  - ${scorer.name}: ${scorer.error || 'Unknown error'}\n`;
            }
          }
        } else if (!failure.success) {
          output += `Error: ${failure.error || 'Unknown error'}\n`;
        }
      }
    }
  }
  
  return output;
}

/**
 * Print evaluation results to the console
 * This matches the Python SDK's output format exactly
 */
export function printResults(results: any[], projectName?: string, evalName?: string): void {
  // Always print a URL if projectName and evalName are provided
  if (projectName && evalName) {
    const baseUrl = 'https://app.judgmentlabs.ai/app/experiment';
    const urlParams = `?project_name=${projectName}&eval_run_name=${evalName}`;
    const resultsUrl = `${baseUrl}${urlParams}`;
    
    // Print the URL
    console.log(`\n🔍 View results: ${resultsUrl}\n`);
  }
  
  // Format the results - only includes failure details
  const formattedResults = formatEvaluationResults(results, projectName, evalName);
  
  // Print the results to the console directly
  if (formattedResults) {
    console.log(formattedResults);
  }
  
  // Print raw results in the same format as Python SDK
  console.log(JSON.stringify(results, null, 2));
}

/**
 * Simplified print function for results - matches Python SDK's print(results) behavior
 * This is the preferred way to print results
 */
export function print(data: any): void {
  if (Array.isArray(data)) {
    // Handle array of results (evaluation results)
    let projectName, evalName;
    
    // Try to extract project name and eval name from the first result
    if (data.length > 0 && data[0].metadata) {
      projectName = data[0].metadata.project_name;
      evalName = data[0].metadata.eval_name;
    }
    
    printResults(data, projectName, evalName);
  } else if (data && typeof data === 'object' && data.traceId) {
    // Handle trace object
    console.log(`\n--- Trace: ${data.name || 'Unnamed'} (ID: ${data.traceId}) ---`);
    if (data.projectName) {
      const traceUrl = `https://app.judgmentlabs.ai/app/monitor?project_name=${data.projectName}&trace_id=${data.traceId}&trace_name=${data.name || 'trace'}&show_trace=true`;
      console.log(`\n🔍 View trace: ${traceUrl}\n`);
    }
    console.log(JSON.stringify(data, null, 2));
  } else {
    // Handle any other object
    console.log(JSON.stringify(data, null, 2));
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
  printResults,
  print
};
