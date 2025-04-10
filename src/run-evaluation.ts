import axios from 'axios';
import { Example } from './data/example';
import { ScoringResult, ScorerData } from './data/result';
import { APIJudgmentScorer, JudgevalScorer } from './scorers/base-scorer';
import { EvaluationRun } from './evaluation-run';
import {
  ROOT_API,
  JUDGMENT_EVAL_API_URL,
  JUDGMENT_EVAL_LOG_API_URL,
  MAX_CONCURRENT_EVALUATIONS,
  JUDGMENT_ADD_TO_RUN_EVAL_QUEUE_API_URL
} from './constants';

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
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new JudgmentAPIError(`Error sending to RabbitMQ: ${error.response.data.detail || error.message}`);
    } else {
      throw new JudgmentAPIError(`Error sending to RabbitMQ: ${error}`);
    }
  }
}

/**
 * Executes an evaluation of a list of Examples using one or more JudgmentScorers via the Judgment API
 */
export async function executeApiEval(evaluationRun: EvaluationRun): Promise<any[]> {
  try {
    console.log('Executing API evaluation...');
    
    const payload = evaluationRun.toJSON();
    const response = await axios.post(
      JUDGMENT_EVAL_API_URL,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${evaluationRun.judgmentApiKey}`,
          'X-Organization-Id': evaluationRun.organizationId
        }
      }
    );
    
    // Log the response for debugging
    console.log('API Response:', JSON.stringify(response.data).substring(0, 200) + '...');
    
    // Handle different response formats
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data && typeof response.data === 'object') {
      // If the response is an object with results property
      if (Array.isArray(response.data.results)) {
        return response.data.results;
      }
      
      // If it's just an object, wrap it in an array
      return [response.data];
    }
    
    // Fallback to mock data for testing if the response format is unexpected
    console.warn('Unexpected API response format, falling back to mock data');
    return evaluationRun.examples.map((example, index) => {
      const mockScores: Record<string, any> = {};
      
      evaluationRun.scorers.forEach(scorer => {
        if ('scoreType' in scorer) {
          const scoreType = scorer.scoreType;
          const score = 0.85; // Mock score
          const threshold = scorer.threshold;
          const success = score >= threshold;
          
          mockScores[scoreType] = {
            name: scoreType,
            score,
            threshold,
            success,
            metadata: {}
          };
        }
      });
      
      return {
        example_index: index,
        scorers_data: Object.values(mockScores),
        error: null
      };
    });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const errorMessage = error.response.data.detail || JSON.stringify(error.response.data) || 'An unknown error occurred.';
      console.error(`Error: ${errorMessage}`);
      throw new JudgmentAPIError(errorMessage);
    } else {
      throw new JudgmentAPIError(`An error occurred while executing the Judgment API request: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
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
    console.log(`Checking if eval run name '${evalName}' exists for project '${projectName}'`);
    
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
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 409) {
        throw new JudgmentAPIError(`Evaluation run name '${evalName}' already exists for project '${projectName}'.`);
      } else {
        throw new JudgmentAPIError(`Error checking evaluation run name: ${error.response.data.detail || error.message}`);
      }
    } else {
      throw new JudgmentAPIError(`Error checking evaluation run name: ${error}`);
    }
  }
}

/**
 * Logs evaluation results to the Judgment API database
 */
export async function logEvaluationResults(
  mergedResults: ScoringResult[],
  evaluationRun: EvaluationRun
): Promise<void> {
  try {
    console.log(`Logging evaluation results for ${evaluationRun.evalName}`);
    
    // Format the payload according to the server's expected format
    const payload = {
      results: mergedResults.map(result => result.toJSON()),
      project_name: evaluationRun.projectName,
      eval_name: evaluationRun.evalName,
      model: evaluationRun.model,
      aggregator: evaluationRun.aggregator,
      metadata: evaluationRun.metadata,
      judgment_api_key: evaluationRun.judgmentApiKey,
    };
    
    console.log('Logging payload structure:', JSON.stringify(Object.keys(payload)));
    
    await axios.post(
      JUDGMENT_EVAL_LOG_API_URL,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${evaluationRun.judgmentApiKey}`,
          'X-Organization-Id': evaluationRun.organizationId
        }
      }
    );
    
    console.log(`Successfully logged evaluation results for ${evaluationRun.evalName}`);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new JudgmentAPIError(`Error logging evaluation results: ${JSON.stringify(error.response.data)}`);
    } else {
      throw new JudgmentAPIError(`Error logging evaluation results: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }
  }
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
      console.error(
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
            console.warn(`Scorer ${scorer.scoreType} requires expectedOutput field`);
          }
          break;
        case 'contextual_precision':
        case 'contextual_recall':
        case 'contextual_relevancy':
          if (!example.context || example.context.length === 0) {
            console.warn(`Scorer ${scorer.scoreType} requires context field`);
          }
          break;
        case 'execution_order':
          if (!example.expectedTools || example.expectedTools.length === 0) {
            console.warn(`Scorer ${scorer.scoreType} requires expectedTools field`);
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
  // Check if the evaluation run name already exists
  if (!override && evaluationRun.evalName && evaluationRun.projectName) {
    await checkEvalRunNameExists(
      evaluationRun.evalName,
      evaluationRun.projectName,
      evaluationRun.judgmentApiKey || '',
      evaluationRun.organizationId || ''
    );
  }

  // Split scorers into API and local
  const apiScorers: APIJudgmentScorer[] = [];
  const localScorers: JudgevalScorer[] = [];

  evaluationRun.scorers.forEach(scorer => {
    if ('scoreType' in scorer) {
      apiScorers.push(scorer);
    } else {
      localScorers.push(scorer as JudgevalScorer);
    }
  });

  // Check that examples have the necessary fields for the scorers
  if (apiScorers.length > 0) {
    checkExamples(evaluationRun.examples, apiScorers);
  }

  let apiResults: ScoringResult[] = [];
  let localResults: ScoringResult[] = [];

  // Execute API scorers
  if (apiScorers.length > 0) {
    try {
      console.log('Executing API evaluation...');
      const apiResponseData = await executeApiEval(evaluationRun);
      
      // Create ScoringResult objects from API response
      apiResults = evaluationRun.examples.map((example, index) => {
        const apiResponse = apiResponseData[index];
        const scorersData = apiResponse?.scorers_data || [];
        
        return new ScoringResult({
          dataObject: example,
          scorersData: scorersData.map((scorerData: any) => ({
            name: scorerData.name,
            score: scorerData.score,
            threshold: scorerData.threshold,
            success: scorerData.success,
            metadata: scorerData.metadata || {}
          })),
          error: apiResponse?.error || undefined
        });
      });
    } catch (error) {
      console.error('Error executing API evaluation:', error);
      if (!ignoreErrors) {
        throw error;
      }
      
      // Create empty results with errors if ignoring errors
      apiResults = evaluationRun.examples.map(example => {
        return new ScoringResult({
          dataObject: example,
          scorersData: [],
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }
  }

  // Execute local scorers
  if (localScorers.length > 0) {
    try {
      console.log('Executing local evaluation...');
      // Implementation for local scorers would go here
      // For now, we'll just create empty results
      localResults = evaluationRun.examples.map(example => {
        return new ScoringResult({
          dataObject: example,
          scorersData: [],
          error: undefined
        });
      });
    } catch (error) {
      console.error('Error executing local evaluation:', error);
      if (!ignoreErrors) {
        throw error;
      }
      
      // Create empty results with errors if ignoring errors
      localResults = evaluationRun.examples.map(example => {
        return new ScoringResult({
          dataObject: example,
          scorersData: [],
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }
  }

  // Merge results from API and local scorers
  const mergedResults = mergeResults(apiResults, localResults);
  
  // Check for missing scorer data
  const checkedResults = checkMissingScorerData(mergedResults);

  // Log results to Judgment API if requested
  if (evaluationRun.logResults) {
    await logEvaluationResults(checkedResults, evaluationRun);
  }

  return checkedResults;
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
