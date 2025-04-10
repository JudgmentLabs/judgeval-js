import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { Example } from './data/example';
import { EvaluationRun } from './evaluation-run';
import { ScoringResult, ScorerData } from './data/result';
import { APIJudgmentScorer, JudgevalScorer } from './scorers/base-scorer';
import { 
  ROOT_API,
  JUDGMENT_EVAL_API_URL,
  JUDGMENT_EVAL_LOG_API_URL,
  MAX_CONCURRENT_EVALUATIONS,
  JUDGMENT_ADD_TO_RUN_EVAL_QUEUE_API_URL,
  JUDGMENT_EVAL_FETCH_API_URL
} from './constants';
import logger from './common/logger';

/**
 * Custom error for Judgment API errors
 */
export class JudgmentAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JudgmentAPIError';
  }
}

/**
 * Validates an API response to ensure it has the expected format
 * Throws a JudgmentAPIError if the response is invalid
 */
export function validateApiResponse(response: any): void {
  if (!response || typeof response !== 'object') {
    throw new JudgmentAPIError('Invalid API response format: response is not an object');
  }
  
  if (response.error) {
    throw new JudgmentAPIError(`API error: ${response.error}`);
  }
}

/**
 * Sends an evaluation run to the RabbitMQ evaluation queue
 */
export async function sendToRabbitMQ(evaluationRun: EvaluationRun): Promise<any> {
  const payload = evaluationRun.toJSON();
  try {
    const response = await axios.post(
      JUDGMENT_ADD_TO_RUN_EVAL_QUEUE_API_URL,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${evaluationRun.judgmentApiKey}`,
          'X-Organization-Id': evaluationRun.organizationId
        }
      }
    );
    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      throw new JudgmentAPIError(`Error sending to RabbitMQ: ${error.response.data.detail || error.message}`);
    } else {
      throw new JudgmentAPIError(`Error sending to RabbitMQ: ${error?.message || String(error)}`);
    }
  }
}

/**
 * Checks the status of an async evaluation
 * @param evaluationRun The evaluation run to check
 * @returns The status of the evaluation
 */
export async function checkEvaluationStatus(evaluationRun: EvaluationRun): Promise<any> {
  try {
    const response = await axios.post(
      `${ROOT_API}/check-eval-status/`,
      {
        eval_name: evaluationRun.evalName,
        project_name: evaluationRun.projectName,
        judgment_api_key: evaluationRun.judgmentApiKey,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${evaluationRun.judgmentApiKey}`,
          'X-Organization-Id': evaluationRun.organizationId
        }
      }
    );
    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      throw new JudgmentAPIError(`Error checking evaluation status: ${error.response.data.detail || error.message}`);
    } else {
      throw new JudgmentAPIError(`Error checking evaluation status: ${error?.message || String(error)}`);
    }
  }
}

/**
 * Polls the status of an async evaluation until it's complete
 * @param evaluationRun The evaluation run to poll
 * @param intervalMs The interval between polls in milliseconds
 * @param maxAttempts The maximum number of polling attempts
 * @param onProgress Optional callback for progress updates
 * @returns The evaluation results
 */
export async function pollEvaluationStatus(
  evaluationRun: EvaluationRun, 
  intervalMs: number = 2000, 
  maxAttempts: number = 300,
  onProgress?: (status: any) => void
): Promise<ScoringResult[]> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const status = await checkEvaluationStatus(evaluationRun);
      
      // Call progress callback if provided
      if (onProgress) {
        onProgress(status);
      }
      
      // Check if evaluation is complete
      if (status.status === 'complete') {
        logger.log('Async evaluation complete, fetching results');
        
        // Fetch the results
        const response = await axios.post(
          JUDGMENT_EVAL_FETCH_API_URL,
          {
            eval_name: evaluationRun.evalName,
            project_name: evaluationRun.projectName,
            judgment_api_key: evaluationRun.judgmentApiKey,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${evaluationRun.judgmentApiKey}`,
              'X-Organization-Id': evaluationRun.organizationId
            }
          }
        );
        
        // Convert API results to ScoringResult objects
        const results = response.data.map((result: any) => {
          return new ScoringResult({
            dataObject: result.example,
            scorersData: result.scorers_data || [],
            error: result.error
          });
        });
        
        return results;
      } else if (status.status === 'failed') {
        throw new JudgmentAPIError(`Async evaluation failed: ${status.error || 'Unknown error'}`);
      }
      
      // Log progress
      logger.log(`Evaluation status: ${status.status}, progress: ${status.progress || 'unknown'}`);
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    } catch (error: any) {
      logger.error(`Error polling evaluation status: ${error?.message || String(error)}`);
      throw new JudgmentAPIError(`Error polling evaluation status: ${error?.message || String(error)}`);
    }
  }
  
  throw new JudgmentAPIError(`Evaluation polling timed out after ${maxAttempts} attempts`);
}

/**
 * Executes an evaluation of a list of Examples using one or more JudgmentScorers via the Judgment API
 */
export async function executeApiEval(evaluationRun: EvaluationRun): Promise<{ results: any[] }> {
  try {
    logger.log('Executing API evaluation...');
    
    // Convert the evaluation run to a JSON payload for the API
    const payload = evaluationRun.toJSON();
    
    // Send the evaluation request to the Judgment API
    // This is where the actual evaluation happens on the server side
    const response = await axios.post(
      JUDGMENT_EVAL_API_URL,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${evaluationRun.judgmentApiKey}`,
          'X-Organization-Id': evaluationRun.organizationId || ''
        }
      }
    );
    
    // Log the response for debugging
    logger.log('API Response:', JSON.stringify(response.data).substring(0, 200) + '...');
    
    // Check if the response status code is not 2XX
    if (response.status < 200 || response.status >= 300) {
      const responseData = response.data;
      const errorMessage = responseData?.detail || 'An unknown error occurred.';
      logger.error(errorMessage);
      throw new JudgmentAPIError(errorMessage);
    }
    
    // Return the response data directly
    // The response contains an array of results, one for each example
    return response.data as { results: any[] };
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      const errorMessage = error.response.data?.detail || JSON.stringify(error.response.data) || 'An unknown error occurred.';
      logger.error(errorMessage);
      throw new JudgmentAPIError(errorMessage);
    } else {
      throw new JudgmentAPIError(`An error occurred while executing the Judgment API request: ${error?.message || String(error)}`);
    }
  }
}

/**
 * Checks if an evaluation run name already exists for a given project
 */
export async function checkEvalRunNameExists(
  evalName: string,
  projectName: string,
  judgmentApiKey: string,
  organizationId: string
): Promise<void> {
  try {
    logger.log(`Checking if eval run name '${evalName}' exists for project '${projectName}'`);
    
    await axios.post(
      `${ROOT_API}/eval-run-name-exists/`,
      {
        eval_name: evalName,
        project_name: projectName,
        judgment_api_key: judgmentApiKey,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${judgmentApiKey}`,
          'X-Organization-Id': organizationId
        }
      }
    );
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 409) {
        throw new JudgmentAPIError(`Evaluation run name '${evalName}' already exists for project '${projectName}'.`);
      } else {
        throw new JudgmentAPIError(`Error checking evaluation run name: ${error.response.data.detail || error.message}`);
      }
    } else {
      throw new JudgmentAPIError(`Error checking evaluation run name: ${error?.message || String(error)}`);
    }
  }
}

/**
 * Logs evaluation results to the console
 * @param results The evaluation results
 * @param projectName The project name
 * @param evalName The evaluation run name
 */
export function logEvaluationResults(
  results: ScoringResult[],
  projectName?: string,
  evalName?: string
): void {
  // Use the printResults function to match Python SDK output format
  logger.printResults(results, projectName, evalName);
}

/**
 * When executing scorers that come from both the Judgment API and local scorers, we're left with
 * results for each type of scorer. This function merges the results from the API and local evaluations,
 * grouped by example.
 */
export function mergeResults(apiResults: ScoringResult[], localResults: ScoringResult[]): ScoringResult[] {
  // No merge required
  if (!localResults.length && apiResults.length) {
    return apiResults;
  }
  if (!apiResults.length && localResults.length) {
    return localResults;
  }

  if (apiResults.length !== localResults.length) {
    // Results should be of same length because each ScoringResult is a 1-1 mapping to an Example
    throw new Error(`The number of API and local results do not match: ${apiResults.length} vs ${localResults.length}`);
  }

  // Each ScoringResult in api and local have all the same fields besides `scorersData`
  for (let i = 0; i < apiResults.length; i++) {
    const apiResult = apiResults[i];
    const localResult = localResults[i];

    if (!apiResult.dataObject || !localResult.dataObject) {
      throw new Error('Data object is null in one of the results.');
    }

    // Verify the results are aligned
    if (apiResult.dataObject.input !== localResult.dataObject.input ||
        apiResult.dataObject.actualOutput !== localResult.dataObject.actualOutput ||
        apiResult.dataObject.expectedOutput !== localResult.dataObject.expectedOutput) {
      throw new Error('The API and local results are not aligned.');
    }

    // Merge ScorerData from the API and local scorers together
    const apiScorerData = apiResult.scorersData;
    const localScorerData = localResult.scorersData;

    if (!apiScorerData && localScorerData) {
      apiResult.scorersData = localScorerData;
    } else if (apiScorerData && localScorerData) {
      apiResult.scorersData = [...apiScorerData, ...localScorerData];
    }
  }

  return apiResults;
}

/**
 * Checks if any ScoringResult objects are missing scorersData
 */
export function checkMissingScorerData(results: ScoringResult[]): ScoringResult[] {
  for (let i = 0; i < results.length; i++) {
    if (!results[i].scorersData || results[i].scorersData?.length === 0) {
      logger.error(
        `Scorer data is missing for example ${i}. ` +
        'This is usually caused when the example does not contain ' +
        'the fields required by the scorer. ' +
        'Check that your example contains the fields required by the scorers.'
      );
    }
  }
  return results;
}

/**
 * Checks if the example contains the necessary parameters for the scorer
 */
export function checkExamples(examples: Example[], scorers: APIJudgmentScorer[]): void {
  for (const scorer of scorers) {
    for (const example of examples) {
      // Check for required fields based on scorer type
      switch (scorer.scoreType) {
        case 'answer_correctness':
        case 'answer_relevancy':
          if (!example.expectedOutput) {
            logger.warn(`Scorer ${scorer.scoreType} requires expectedOutput field`);
          }
          break;
        case 'contextual_precision':
        case 'contextual_recall':
        case 'contextual_relevancy':
          if (!example.context || example.context.length === 0) {
            logger.warn(`Scorer ${scorer.scoreType} requires context field`);
          }
          break;
        case 'execution_order':
          if (!example.expectedTools || example.expectedTools.length === 0) {
            logger.warn(`Scorer ${scorer.scoreType} requires expectedTools field`);
          }
          break;
        // Add more checks for other scorer types as needed
      }
    }
  }
}

/**
 * Executes an evaluation of Examples using one or more Scorers
 */
export async function runEval(
  evaluationRun: EvaluationRun,
  override: boolean = false,
  ignoreErrors: boolean = true,
  asyncExecution: boolean = false
): Promise<ScoringResult[]> {
  // Disable all logging to match Python SDK output format
  process.env.DISABLE_LOGGING = 'true';
  
  // Completely disable console output for internal logging
  // This is needed to match the Python SDK's output format exactly
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  
  // Override console methods to only allow specific messages through
  console.log = function(...args) {
    if (args[0] === 'Successfully initialized JudgmentClient!') {
      originalConsoleLog.apply(console, args);
    }
  };
  console.info = function() {};
  console.warn = function() {};
  console.error = function(...args) {
    if (args[0] && args[0].toString().includes('environment variable is not set')) {
      originalConsoleError.apply(console, args);
    }
  };

  // Enable logging by default
  logger.enableLogging('judgeval', './logs');

  // Check if the evaluation run name already exists
  // This prevents accidentally overwriting existing evaluation results
  if (!override && evaluationRun.logResults) {
    await checkEvalRunNameExists(
      evaluationRun.evalName || '',
      evaluationRun.projectName || '',
      evaluationRun.judgmentApiKey || '',
      evaluationRun.organizationId || ''
    );
  }

  // --- Set example IDs and timestamps if not already set ---
  // This is important for tracking and debugging purposes
  logger.log("Initializing examples with IDs and timestamps");
  evaluationRun.examples.forEach((example, idx) => {
    example.exampleIndex = idx;  // Set numeric index
    example.timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    logger.log(`Initialized example ${example.exampleId} (index: ${example.exampleIndex})`);
    logger.log(`Input: ${example.input}`);
    logger.log(`Actual output: ${example.actualOutput || ''}`);
    if (example.expectedOutput) {
      logger.log(`Expected output: ${example.expectedOutput}`);
    }
    if (example.context) {
      logger.log(`Context: ${example.context}`);
    }
  });

  logger.log(`Starting evaluation run with ${evaluationRun.examples.length} examples`);

  // --- Split scorers into API and local ---
  // API scorers run on the Judgment API server
  // Local scorers run in this process
  logger.log("Grouping scorers by type");
  const apiScorers: APIJudgmentScorer[] = [];
  const localScorers: JudgevalScorer[] = [];

  evaluationRun.scorers.forEach(scorer => {
    if (scorer instanceof APIJudgmentScorer) {
      apiScorers.push(scorer);
      logger.log(`Added judgment scorer: ${scorer.constructor.name}`);
    } else {
      localScorers.push(scorer as JudgevalScorer);
      logger.log(`Added local scorer: ${scorer.constructor.name}`);
    }
  });

  logger.log(`Found ${apiScorers.length} judgment scorers and ${localScorers.length} local scorers`);

  let apiResults: ScoringResult[] = [];
  let localResults: ScoringResult[] = [];

  // --- Handle async execution ---
  // This allows evaluations to run in the background without blocking
  // Useful for large-scale evaluations that might take a long time
  if (asyncExecution) {
    checkExamples(evaluationRun.examples, evaluationRun.scorers as APIJudgmentScorer[]);
    logger.log("Starting async evaluation");
    
    try {
      // Add the evaluation to the RabbitMQ queue for async processing
      // The server will pick it up and process it in the background
      const response = await sendToRabbitMQ(evaluationRun);
      
      // Log the response for debugging
      logger.log(`Successfully added evaluation to queue: ${JSON.stringify(response)}`);
      
      // Set up progress tracking
      const progressTracker = {
        evalName: evaluationRun.evalName,
        projectName: evaluationRun.projectName,
        status: 'queued',
        startTime: new Date(),
        lastChecked: new Date(),
        progress: 0
      };
      
      // Return the progress tracker object
      // This allows the caller to check the status of the evaluation
      console.log(`Async evaluation started. Track progress with JudgmentClient.checkEvalStatus("${evaluationRun.projectName}", "${evaluationRun.evalName}")`);
      
      // Return empty results for async execution
      // The results will be available later via the UI or API
      return [];
    } catch (error: any) {
      logger.error(`Error adding evaluation to queue: ${error?.message || String(error)}`);
      throw new JudgmentAPIError(`Error adding evaluation to queue: ${error?.message || String(error)}`);
    }
  } else {
    // --- Execute API scorers ---
    // These run on the Judgment API server
    if (apiScorers.length > 0) {
      // Check that examples have the necessary fields for the scorers
      checkExamples(evaluationRun.examples, apiScorers);
      logger.log('Starting API evaluation');
      logger.log(`Creating API evaluation run with ${apiScorers.length} scorers`);
      
      try {
        // Create a new EvaluationRun with just the API scorers
        // This is to ensure we only send the necessary data to the API
        const apiEvaluationRun = new EvaluationRun({
          evalName: evaluationRun.evalName,
          projectName: evaluationRun.projectName,
          examples: evaluationRun.examples,
          scorers: apiScorers,
          model: evaluationRun.model,
          aggregator: evaluationRun.aggregator,
          metadata: evaluationRun.metadata,
          judgmentApiKey: evaluationRun.judgmentApiKey,
          organizationId: evaluationRun.organizationId,
          logResults: evaluationRun.logResults,
          rules: evaluationRun.rules
        });
        
        logger.log('Sending request to Judgment API');
        const responseData = await executeApiEval(apiEvaluationRun);
        
        // Ensure responseData has a results property
        if (!responseData || !Array.isArray(responseData.results)) {
          throw new Error('Invalid response format from API: missing results array');
        }
        
        logger.log(`Received ${responseData.results.length} results from API`);
        
        // --- Convert the response data to ScoringResult objects ---
        // This transforms the raw API response into our internal format
        logger.log('Processing API results');
        
        // Log the full response structure for debugging
        logger.log('API response structure:', JSON.stringify(responseData.results[0], null, 2).substring(0, 500) + '...');
        
        apiResults = responseData.results.map((result: any, index: number) => {
          // Debug logging to understand the structure
          logger.log(`Processing result ${index}:`);
          logger.log(`- Keys: ${JSON.stringify(Object.keys(result))}`);
          
          // Check if example exists
          if (!result.example) {
            logger.log(`- WARNING: No example data in result ${index}`);
          }
          
          // Check if scorers_data exists and has content
          if (!result.scorers_data || result.scorers_data.length === 0) {
            logger.log(`- WARNING: No scorers_data in result ${index}`);
          } else {
            logger.log(`- Found ${result.scorers_data.length} scorer data entries`);
            // Log the first scorer data for debugging
            if (result.scorers_data[0]) {
              logger.log(`- First scorer: ${JSON.stringify(result.scorers_data[0])}`);
            }
          }
          
          // Create a ScoringResult with the data from the API response
          return new ScoringResult({
            dataObject: result.example || evaluationRun.examples[index],
            scorersData: result.scorers_data || [],
            error: result.error
          });
        });
        
        // --- Placeholder for cost calculation ---
        // Replace this with actual cost calculation logic,
        // similar to Python's `cost_per_token(model=modelName, prompt_tokens=..., completion_tokens=...)`
        // You'll need a way to access model cost data (e.g., a library, a map, an API call).
        const promptCost = 0.0; // Replace with calculated prompt cost
        const completionCost = 0.0; // Replace with calculated completion cost
        const callTotalCost = promptCost + completionCost;
        
      } catch (error: any) {
        logger.error(`Error executing API evaluation: ${error?.message || String(error)}`);
        if (!ignoreErrors) {
          throw error;
        }
        
        // Create empty results with errors if ignoring errors
        // This allows the evaluation to continue even if some scorers fail
        apiResults = evaluationRun.examples.map(example => {
          return new ScoringResult({
            dataObject: example,
            scorersData: [],
            error: error?.message
          });
        });
      }
    }

    // --- Execute local scorers ---
    // These run in this process
    if (localScorers.length > 0) {
      logger.log('Starting local evaluation');
      try {
        // TODO: Add async handling like Python's _update_coroutine_output if needed for Promises
        // Implementation for local scorers would go here
        // For now, we'll just create empty results
        localResults = evaluationRun.examples.map(example => {
          return new ScoringResult({
            dataObject: example,
            scorersData: [],
            error: undefined
          });
        });
        logger.log(`Local evaluation complete with ${localResults.length} results`);
      } catch (error: any) {
        logger.error(`Error executing local evaluation: ${error?.message || String(error)}`);
        if (!ignoreErrors) {
          throw error;
        }
        
        // Create empty results with errors if ignoring errors
        localResults = evaluationRun.examples.map(example => {
          return new ScoringResult({
            dataObject: example,
            scorersData: [],
            error: error?.message
          });
        });
      }
    }

    // --- Merge results from API and local scorers ---
    // This combines the results from both types of scorers
    // Align with Python - only record content and usage base
    logger.log('Merging API and local results');
    const mergedResults = mergeResults(apiResults, localResults);
    
    // Check for missing scorer data
    // This helps identify examples that couldn't be evaluated
    const checkedResults = checkMissingScorerData(mergedResults);
    logger.log(`Successfully merged ${checkedResults.length} results`);

    // --- Log results to Judgment API if requested ---
    // This saves the results to the database for later viewing
    if (evaluationRun.logResults) {
      try {
        logEvaluationResults(checkedResults, evaluationRun.projectName, evaluationRun.evalName);
      } catch (error: any) {
        logger.error(`Error logging evaluation results: ${error?.message || String(error)}`);
        if (!ignoreErrors) {
          throw error;
        }
      }
    }

    // --- Check for examples with no scorer data ---
    // This helps identify examples that couldn't be evaluated
    for (let i = 0; i < checkedResults.length; i++) {
      const result = checkedResults[i];
      if (!result.scorersData || result.scorersData.length === 0) {
        logger.log(`None of the scorers could be executed on example ${i}. This is usually because the Example is missing the fields needed by the scorers. Try checking that the Example has the necessary fields for your scorers.`);
      }
    }

    return checkedResults;
  }
}

/**
 * Collects all failed scorers from the scoring results
 * Raises exceptions for any failed test cases
 */
export function assertTest(scoringResults: ScoringResult[]): void {
  const failedTests: string[] = [];

  for (const result of scoringResults) {
    if (result.error) {
      failedTests.push(`Error in result: ${result.error}`);
      continue;
    }

    if (!result.scorersData || result.scorersData?.length === 0) {
      failedTests.push('No scorer data found in result');
      continue;
    }

    for (const scorerData of result.scorersData) {
      if (!scorerData.success) {
        failedTests.push(
          `Test failed: ${scorerData.name} with score ${scorerData.score} ` +
          `(threshold: ${scorerData.threshold})`
        );
      }
    }
  }

  if (failedTests.length > 0) {
    throw new Error(`Test assertion failed:\n${failedTests.join('\n')}`);
  }
}
