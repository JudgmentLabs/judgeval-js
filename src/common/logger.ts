/**
 * Logger utilities and result printing for the JudgEval TypeScript SDK
 */

// Remove fs and path imports if no longer needed
// import * as fs from 'fs';
// import * as path from 'path';
import logger from './logger-instance.js'; // Import the configured winston logger

// Track current example info (Keep for potential context integration)
let currentExampleId: string | null = null;
let currentTimestamp: string | null = null;

/**
 * Log a debug message
 */
export function debug(message: string, meta?: Record<string, any>): void {
  // Prioritize meta.exampleId over currentExampleId
  const exampleId = meta?.exampleId !== undefined ? meta.exampleId : currentExampleId;
  logger.debug(message, { ...meta, exampleId, timestamp: currentTimestamp });
}

/**
 * Log an info message (alias for info)
 */
export function log(message: string, meta?: Record<string, any>): void {
  // Prioritize meta.exampleId over currentExampleId
  const exampleId = meta?.exampleId !== undefined ? meta.exampleId : currentExampleId;
  logger.info(message, { ...meta, exampleId, timestamp: currentTimestamp });
}

/**
 * Log an info message
 */
export function info(message: string, meta?: Record<string, any>): void {
  // Prioritize meta.exampleId over currentExampleId
  const exampleId = meta?.exampleId !== undefined ? meta.exampleId : currentExampleId;
  logger.info(message, { ...meta, exampleId, timestamp: currentTimestamp });
}

/**
 * Log a warning message
 */
export function warning(message: string, meta?: Record<string, any>): void {
  // Prioritize meta.exampleId over currentExampleId
  const exampleId = meta?.exampleId !== undefined ? meta.exampleId : currentExampleId;
  logger.warn(message, { ...meta, exampleId, timestamp: currentTimestamp });
}

/**
 * Alias for warning
 */
export function warn(message: string, meta?: Record<string, any>): void {
  warning(message, meta);
}

/**
 * Log an error message
 */
export function error(message: string, meta?: Record<string, any>): void {
  // Prioritize meta.exampleId over currentExampleId
  const exampleId = meta?.exampleId !== undefined ? meta.exampleId : currentExampleId;
  logger.error(message, { ...meta, exampleId, timestamp: currentTimestamp });
}

/**
 * Set the current example context for logging (Keep for potential context integration)
 */
export function setExampleContext(exampleId: string, timestamp: string): void {
  currentExampleId = exampleId;
  currentTimestamp = timestamp;
}

/**
 * Clear the current example context (Keep for potential context integration)
 */
export function clearExampleContext(): void {
  currentExampleId = null;
  currentTimestamp = null;
}

/**
 * Create a context for example-specific logging (Keep for potential context integration)
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
  } else if (data && typeof data === 'object' && data.title === "Workflow Analysis Results") {
    // Handle workflow analysis results
    console.log(`\n=== ${data.title} ===\n`);
    
    // Print scorer performance
    console.log('Scorer Performance Summary:');
    console.log('----------------------------');
    if (Array.isArray(data.scorerPerformance)) {
      data.scorerPerformance.forEach((scorer: any) => {
        console.log(`${scorer.name.padEnd(30)} ${scorer.score.toFixed(2)} (${scorer.rating})`);
      });
    }
    
    // Print areas for improvement
    if (Array.isArray(data.areasForImprovement) && data.areasForImprovement.length > 0) {
      console.log('\nAreas for Improvement:');
      console.log('----------------------');
      data.areasForImprovement.forEach((area: string, index: number) => {
        console.log(`${index + 1}. ${area}`);
      });
    }
    
    // Print strengths
    if (Array.isArray(data.strengths) && data.strengths.length > 0) {
      console.log('\nStrengths:');
      console.log('----------');
      data.strengths.forEach((strength: string, index: number) => {
        console.log(`${index + 1}. ${strength}`);
      });
    }
  } else if (data && typeof data === 'object' && data.title && data.recommendations) {
    // Handle recommendations
    console.log(`\n=== ${data.title} ===`);
    
    if (Array.isArray(data.recommendations)) {
      data.recommendations.forEach((rec: string, index: number) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
  } else {
    // Handle any other object
    console.log(JSON.stringify(data, null, 2));
  }
}
