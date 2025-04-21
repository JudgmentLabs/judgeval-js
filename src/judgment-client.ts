import * as dotenv from 'dotenv';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { Example, ExampleOptions } from './data/example.js';
import { ScoringResult } from './data/result.js';
import { APIJudgmentScorer, JudgevalScorer, ScorerWrapper } from './scorers/base-scorer.js';
import { EvaluationRun } from './evaluation-run.js';
import { Rule, Condition } from './rules.js';
import { runEval, assertTest, JudgmentAPIError } from './run-evaluation.js';
import {
  ROOT_API,
  JUDGMENT_EVAL_FETCH_API_URL,
  JUDGMENT_EVAL_DELETE_API_URL,
  JUDGMENT_EVAL_DELETE_PROJECT_API_URL,
  JUDGMENT_PROJECT_DELETE_API_URL,
  JUDGMENT_PROJECT_CREATE_API_URL,
} from './constants.js';
import logger from './common/logger-instance.js';
// Keep progress bar imports if used elsewhere (e.g., waitForEvaluation)
import cliProgress from 'cli-progress'; 
import colors from 'ansi-colors'; 
import { EvalDatasetClient } from './data/datasets/eval-dataset-client.js';

// Load environment variables
dotenv.config();

/**
 * Request body for eval run operations (fetch/pull)
 */
interface EvalRunRequestBody {
  project_name: string;
  eval_name: string;
  judgment_api_key: string; // Keep this as pullEval/fetch API needs it in body
}

/**
 * Request body for deleting eval runs
 */
interface DeleteEvalRunRequestBody {
  eval_names: string[];
  project_name: string;
  judgment_api_key: string; // Keep this as delete API needs it in body
}

/**
 * Singleton implementation for JudgmentClient
 */
export class JudgmentClient {
  private static instance: JudgmentClient;
  private judgmentApiKey: string;
  private organizationId: string;
  
  /**
   * Get the singleton instance of JudgmentClient
   */
  public static getInstance(judgmentApiKey?: string, organizationId?: string): JudgmentClient {
    if (!JudgmentClient.instance) {
      JudgmentClient.instance = new JudgmentClient(judgmentApiKey, organizationId);
    }
    return JudgmentClient.instance;
  }

  /**
   * Constructor for JudgmentClient
   * @param judgmentApiKey The Judgment API key
   * @param organizationId The organization ID
   */
  constructor(
    judgmentApiKey?: string,
    organizationId?: string
  ) {
    this.judgmentApiKey = judgmentApiKey || process.env.JUDGMENT_API_KEY || '';
    this.organizationId = organizationId || process.env.JUDGMENT_ORG_ID || '';
    
    // Keep this as direct output
    console.log('Successfully initialized JudgmentClient!');
    
    if (!this.judgmentApiKey) {
      // Use logger for internal error, but throw for user
      logger.error('JUDGMENT_API_KEY is not set.')
      throw new Error('Judgment API key is required. Set it in the constructor or as an environment variable JUDGMENT_API_KEY.');
    }
    
    if (!this.organizationId) {
      throw new Error('Organization ID is required. Set it in the constructor or as an environment variable JUDGMENT_ORG_ID.');
    }
  }

  /**
   * Run an evaluation asynchronously
   */
  public async aRunEvaluation(
    examples: Example[],
    scorers: Array<ScorerWrapper | JudgevalScorer | APIJudgmentScorer>,
    model: string | string[] | any,
    aggregator?: string,
    metadata?: Record<string, any>,
    logResults: boolean = true,
    projectName: string = 'default_project',
    evalRunName: string = 'default_eval_run',
    override: boolean = false,
    useJudgment: boolean = true,
    ignoreErrors: boolean = true,
    rules?: Rule[]
  ): Promise<ScoringResult[]> {
    // Simply call runEvaluation with asyncExecution=true
    return this.runEvaluation(
      examples, 
      scorers, 
      model, 
      aggregator, 
      metadata, 
      logResults, 
      projectName, 
      evalRunName, 
      override, 
      useJudgment, 
      ignoreErrors, 
      true, // Set asyncExecution to true
      rules
    );
  }

  /**
   * Run an evaluation
   */
  public async runEvaluation(
    examples: Example[],
    scorers: Array<ScorerWrapper | JudgevalScorer | APIJudgmentScorer>,
    model: string | string[] | any,
    aggregator?: string,
    metadata?: Record<string, any>,
    logResults: boolean = true,
    projectName: string = 'default_project',
    evalRunName: string = 'default_eval_run',
    override: boolean = false,
    useJudgment: boolean = true,
    ignoreErrors: boolean = true,
    asyncExecution: boolean = false,
    rules?: Rule[]
  ): Promise<ScoringResult[]> {
    try {
      // Load appropriate implementations for all scorers
      const loadedScorers: Array<JudgevalScorer | APIJudgmentScorer> = [];
      for (const scorer of scorers) {
        try {
          if (scorer instanceof ScorerWrapper) {
            loadedScorers.push(scorer.loadImplementation(useJudgment));
          } else {
            // Assume scorers passed are already JudgevalScorer or APIJudgmentScorer
            loadedScorers.push(scorer as JudgevalScorer | APIJudgmentScorer);
          }
        } catch (error) {
          throw new Error(`Failed to load implementation for scorer ${scorer.constructor.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Prevent using JudgevalScorer with rules - only APIJudgmentScorer allowed with rules
      if (rules && loadedScorers.some(scorer => scorer instanceof JudgevalScorer)) {
        throw new Error('Cannot use Judgeval scorers (only API scorers) when using rules. Please either remove rules or use only APIJudgmentScorer types.');
      }

      // Convert ScorerWrapper in rules to their implementations
      let loadedRules: Rule[] | undefined;
      if (rules) {
        loadedRules = [];
        for (const rule of rules) {
          try {
            const processedConditions: Condition[] = [];
            for (const condition of rule.conditions) {
              // Convert metric if it's a ScorerWrapper
              if (condition.metric instanceof ScorerWrapper) {
                try {
                  // Create a new Condition object with the loaded implementation
                  const loadedMetric = condition.metric.loadImplementation(useJudgment);
                  const newCondition = new Condition(loadedMetric);
                  // Copy other properties from the original condition if necessary
                  // Example: newCondition.threshold = condition.threshold;
                  Object.assign(newCondition, { ...condition, metric: loadedMetric }); // Copy all properties, overriding metric
                  processedConditions.push(newCondition);
                } catch (error) {
                  throw new Error(`Failed to convert ScorerWrapper to implementation in rule '${rule.name}', condition metric '${condition.metric.constructor.name}': ${error instanceof Error ? error.message : String(error)}`);
                }
              } else {
                processedConditions.push(condition);
              }
            }
            
            // Create new rule with processed conditions
            const newRule = new Rule(
              rule.name,
              processedConditions,
              rule.combine_type,
              rule.description,
              rule.notification,
              rule.ruleId
            );
            loadedRules.push(newRule);
          } catch (error) {
            throw new Error(`Failed to process rule '${rule.name}': ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      const evaluationRun = new EvaluationRun({
        logResults,
        projectName,
        evalName: evalRunName,
        examples,
        scorers: loadedScorers,
        model,
        aggregator,
        metadata,
        judgmentApiKey: this.judgmentApiKey,
        rules: loadedRules,
        organizationId: this.organizationId
      });

      return runEval(evaluationRun, override, ignoreErrors, asyncExecution);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('one or more fields are invalid')) {
          throw new Error(`Please check your EvaluationRun object, one or more fields are invalid: \n${error.message}`);
        } else {
          throw new Error(`An unexpected error occurred during evaluation: ${error.message}`);
        }
      } else {
        throw new Error(`An unexpected error occurred during evaluation: ${String(error)}`);
      }
    }
  }

  /**
   * Run an evaluation with a simplified interface (recommended)
   * @param config Configuration object for the evaluation
   * @returns Promise<ScoringResult[]> The evaluation results
   */
  public async evaluate(config: {
    examples: Example[];
    scorers: Array<ScorerWrapper | JudgevalScorer | APIJudgmentScorer>;
    model?: string | string[] | any;
    aggregator?: string;
    metadata?: Record<string, any>;
    projectName?: string;
    evalName?: string;
    logResults?: boolean;
    useJudgment?: boolean;
    ignoreErrors?: boolean;
    asyncExecution?: boolean;
    rules?: Rule[];
    override?: boolean;
  }): Promise<ScoringResult[]> {
    // Set default values
    const {
      examples,
      scorers,
      model = 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo',
      aggregator = undefined,
      metadata = {},
      projectName = 'default_project',
      evalName = `eval-run-${Date.now()}`,
      logResults = true,
      useJudgment = true,
      ignoreErrors = true,
      asyncExecution = false,
      rules = undefined,
      override = false
    } = config;

    // Call the original runEvaluation method with the extracted parameters
    return this.runEvaluation(
      examples,
      scorers,
      model,
      aggregator,
      metadata,
      logResults,
      projectName,
      evalName,
      override,
      useJudgment,
      ignoreErrors,
      asyncExecution,
      rules
    );
  }

  /**
   * Evaluate a dataset
   */
  public async evaluateDataset(
    dataset: any, // Keep type loose for stub
    scorers: Array<ScorerWrapper | JudgevalScorer>,
    model: string | string[] | any,
    aggregator?: string,
    metadata?: Record<string, any>,
    projectName: string = 'default_project',
    evalRunName: string = 'default_eval_run',
    logResults: boolean = true,
    useJudgment: boolean = true,
    rules?: Rule[]
  ): Promise<ScoringResult[]> {
    // Keep type loose for stub
    throw new Error('Not implemented in JudgmentClient. Use EvalDatasetClient.');
  }

  /**
   * Pull evaluation results from the server
   * 
   * @param projectName Name of the project
   * @param evalRunName Name of the evaluation run
   * @returns Array of evaluation result objects with the same format as the Python SDK
   */
  public async pullEval(
    projectName: string,
    evalRunName: string
  ): Promise<any[]> {
    const evalRunRequestBody = {
      project_name: projectName,
      eval_name: evalRunName,
      judgment_api_key: this.judgmentApiKey
    };

    try {
      logger.info(`Pulling evaluation results for project '${projectName}', run '${evalRunName}'`);
      
      const response = await axios.post(
        JUDGMENT_EVAL_FETCH_API_URL,
        evalRunRequestBody,
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.judgmentApiKey}`,
            "X-Organization-Id": this.organizationId
          }
        }
      );

      // Ensure we return the data in the exact same format as the Python SDK
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorMessage = `Error fetching eval results: ${JSON.stringify(error.response.data)}`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
      } else {
        const errorMessage = `Unknown error during pullEval: ${error}`;
        logger.error(errorMessage);
        throw error;
      }
    }
  }

  /**
   * Retrieves evaluation results with retry mechanism
   * @param projectName Name of the project
   * @param evalRunName Name of the evaluation run
   * @param options Configuration options for retries
   * @returns The evaluation results or null if not available after all retries
   */
  public async pullEvalWithRetry(
    projectName: string,
    evalRunName: string,
    options: {
      maxRetries?: number;
      initialDelayMs?: number;
      maxDelayMs?: number;
      backoffFactor?: number;
    } = {}
  ): Promise<any> {
    // Default options
    const maxRetries = options.maxRetries || 3;
    const initialDelayMs = options.initialDelayMs || 2000;
    const maxDelayMs = options.maxDelayMs || 30000;
    const backoffFactor = options.backoffFactor || 2;

    let lastError: any = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Calculate delay with exponential backoff, capped at maxDelayMs
        const delayMs = Math.min(
          initialDelayMs * Math.pow(backoffFactor, attempt),
          maxDelayMs
        );
        
        if (attempt > 0) {
          logger.info(`Retry attempt ${attempt + 1}/${maxRetries} for pullEval after ${delayMs}ms delay`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        const results = await this.pullEval(projectName, evalRunName);
        return results;
      } catch (error) {
        lastError = error;
        
        // Check if we should retry based on error type
        if (axios.isAxiosError(error) && error.response) {
          const status = error.response.status;
          
          // Don't retry for client errors (except 429 Too Many Requests)
          if (status >= 400 && status < 500 && status !== 429) {
            logger.error(`Not retrying due to client error: ${status}`);
            throw error;
          }
        }
        
        logger.warn(`Attempt ${attempt + 1} failed, ${attempt < maxRetries - 1 ? 'will retry' : 'giving up'}`);
      }
    }
    
    // If we get here, all retries failed
    logger.error(`All ${maxRetries} retry attempts failed for pullEval`);
    throw lastError || new Error('Failed to retrieve evaluation results after all retry attempts');
  }

  /**
   * Export evaluation results to a file format
   * @param projectName Name of the project
   * @param evalRunName Name of the evaluation run
   * @param format Export format ('json' or 'csv')
   * @returns The exported data as a string
   */
  public async exportEvalResults(
    projectName: string,
    evalRunName: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    logger.info(`Exporting eval results for project '${projectName}', run '${evalRunName}' as ${format}`);
    try {
      const resultsData = await this.pullEval(projectName, evalRunName);

      if (!resultsData || resultsData.length === 0 || !resultsData[0].results) {
        logger.warn('No results found to export.');
        return '';
      }

      const results = resultsData[0].results as ScoringResult[];

      if (format === 'json') {
        // Pretty print JSON
        return JSON.stringify(results.map(r => r.toJSON()), null, 2);
      } else if (format === 'csv') {
        if (results.length === 0) return ''; // No data to export

        // Dynamically determine headers from the first result object
        // Flatten the structure for CSV
        const flatResults = results.map(result => {
          const flat: Record<string, any> = {};
          const exampleData = result.dataObject?.toJSON() ?? {}; // Use toJSON which gives snake_case
          const scorersData = result.scorersData ?? [];
          
          // Add example data fields (snake_case)
          for (const key in exampleData) {
             // Prefix example fields to avoid collision, e.g., example_input
            flat[`example_${key}`] = exampleData[key]; 
          }

          // Add scorers data
          scorersData.forEach(scorer => {
            flat[`scorer_${scorer.name}_score`] = scorer.score;
            flat[`scorer_${scorer.name}_additional_metadata`] = JSON.stringify(scorer.additional_metadata);
            flat[`scorer_${scorer.name}_error`] = scorer.error;
          });
          
          // Add top-level error if present
          flat['top_level_error'] = result.error;

          return flat;
        });

        // Get all unique keys from the flattened results for headers
        const headers = Array.from(new Set(flatResults.flatMap(Object.keys)));

        // Use papaparse for robust CSV generation
        const Papa = require('papaparse'); // Use require here if not imported at top
        const csv = Papa.unparse({
          fields: headers,
          data: flatResults
        }, {
          header: true,
          quotes: true, // Ensure fields with commas/newlines are quoted
          quoteChar: '"',
          escapeChar: '"',
          delimiter: ','
        });

        return csv;
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      logger.error(`Error exporting eval results: ${error}`);
      this.handleApiError(error, 'exportEvalResults');
      throw error;
    }
  }

  /**
   * Delete an evaluation from the server
   */
  public async deleteEval(
    projectName: string,
    evalRunNames: string[]
  ): Promise<boolean> {
    logger.info(`Deleting eval runs: ${evalRunNames.join(', ')} from project: ${projectName}`);
    const requestBody: DeleteEvalRunRequestBody = {
      project_name: projectName,
      eval_names: evalRunNames,
      judgment_api_key: this.judgmentApiKey,
    };

    try {
      await axios.post(JUDGMENT_EVAL_DELETE_API_URL, requestBody, {
        headers: this.getAuthHeaders()
      });
      logger.info('Successfully deleted eval runs.');
      return true;
    } catch (error) {
      logger.error(`Error deleting eval runs: ${error}`);
      this.handleApiError(error, 'deleteEval');
      return false;
    }
  }

  /**
   * Delete all evaluations from the server for a given project
   */
  public async deleteProjectEvals(
    projectName: string
  ): Promise<boolean> {
    logger.info(`Deleting ALL eval runs for project: ${projectName}`);
    const requestBody = {
      project_name: projectName,
      judgment_api_key: this.judgmentApiKey,
    };

    try {
      await axios.post(JUDGMENT_EVAL_DELETE_PROJECT_API_URL, requestBody, {
        headers: this.getAuthHeaders()
      });
      logger.info(`Successfully deleted all eval runs for project ${projectName}.`);
      return true;
    } catch (error) {
      logger.error(`Error deleting project evals: ${error}`);
      this.handleApiError(error, 'deleteProjectEvals');
      return false;
    }
  }

  /**
   * Create a project on the server
   */
  public async createProject(
    projectName: string
  ): Promise<boolean> {
    logger.info(`Creating project: ${projectName}`);
    const requestBody = {
      project_name: projectName,
      judgment_api_key: this.judgmentApiKey,
    };

    try {
      logger.info(`Creating project: ${projectName}`);
      const response = await axios.post(JUDGMENT_PROJECT_CREATE_API_URL, requestBody, {
         headers: this.getAuthHeaders()
      });
      
      // Check for specific success message or status if API provides one
      if (response.data && response.data.message === 'Project added successfully') {
         logger.info(`Successfully created project: ${projectName}`);
         return true;
      } else if (response.data && response.data.message === 'Project already exists') {
          logger.warn(`Project '${projectName}' already exists.`);
          return true; // Or false, depending on desired behavior for existing projects
      } else {
          logger.error(`Failed to create project '${projectName}'. Response: ${JSON.stringify(response.data)}`);
          return false;
      }

    } catch (error) {
      logger.error(`Error creating project: ${error}`);
      this.handleApiError(error, 'createProject');
      return false;
    }
  }

  /**
   * Delete a project from the server
   */
  public async deleteProject(
    projectName: string
  ): Promise<boolean> {
    logger.info(`Deleting project: ${projectName}`);
    const requestBody = {
      project_name: projectName,
      judgment_api_key: this.judgmentApiKey,
    };

    try {
       const response = await axios.post(JUDGMENT_PROJECT_DELETE_API_URL, requestBody, {
         headers: this.getAuthHeaders()
      });

       if (response.data && response.data.message === 'Project deleted successfully') {
         logger.info(`Successfully deleted project: ${projectName}`);
         return true;
       } else {
         logger.error(`Failed to delete project '${projectName}'. Response: ${JSON.stringify(response.data)}`);
         return false;
       }
    } catch (error) {
      logger.error(`Error deleting project: ${error}`);
      this.handleApiError(error, 'deleteProject');
      return false;
    }
  }

  /**
   * Validate that the user API key is valid
   */
  private async validateApiKey(): Promise<[boolean, string]> {
    logger.debug('Validating API Key...');
    try {
      // Instantiate EvalDatasetClient to perform the validation call
      const datasetClient = new EvalDatasetClient(this.judgmentApiKey, this.organizationId);
      // Use the dataset client to make the call
      await datasetClient.pullProjectDatasetStats('__api_key_validation__'); 
      logger.debug('API Key appears valid.');
      return [true, 'API Key is valid.'];
    } catch (error) {
      let message = 'API Key validation failed.';
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          message = 'API Key is invalid or expired.';
        } else if (error.response?.status === 404) {
          // If validation endpoint returns 404, key might be valid but endpoint wrong/project not found
          // This depends on the specific validation endpoint behavior
          message = 'API Key might be valid, but validation endpoint returned 404.'; 
        } else {
          message = `API Key validation failed with status ${error.response?.status}: ${error.message}`;
        }
      } else {
        message = `API Key validation failed: ${String(error)}`;
      }
      logger.error(message);
      return [false, message];
    }
  }

  /**
   * Assert a test by running the evaluation and checking the results for success
   */
  public async assertTest(
    examples: Example[],
    scorers: Array<APIJudgmentScorer | JudgevalScorer>, // Type matches Python's intent
    model: string | string[] | any,
    aggregator?: string,
    metadata?: Record<string, any>,
    logResults: boolean = true,
    projectName: string = 'default_project',
    evalRunName: string = 'default_eval_run',
    override: boolean = false,
    rules?: Rule[]
  ): Promise<void> {
    const results = await this.runEvaluation(
      examples,
      scorers,
      model,
      aggregator,
      metadata,
      logResults,
      projectName,
      evalRunName,
      override,
      true, // useJudgment = true (necessary if API scorers or rules are involved)
      false, // ignoreErrors = false for assert
      false, // asyncExecution = false
      rules
    );

    assertTest(results); // Assumes assertTest handles ScoringResult[]
  }

  /**
   * Pull the results of an evaluation run. Matches `pullEval` logic but returns only the ScoringResult array.
   * @param projectName The name of the project
   * @param evalRunName The name of the evaluation run
   * @returns Array of ScoringResult objects
   */
  async pullEvalResults(projectName: string, evalRunName: string): Promise<ScoringResult[]> {
    // Get the raw API response
    const rawResults = await this.pullEval(projectName, evalRunName);
    
    // Ensure proper handling of empty results
    if (!rawResults || !Array.isArray(rawResults) || rawResults.length === 0) {
      return [];
    }
    
    // Process the results to match Python SDK format
    const scoringResults: ScoringResult[] = [];
    
    for (const item of rawResults) {
      if (item.result && item.result.scorers_data && Array.isArray(item.result.scorers_data)) {
        // Extract example data if available
        const exampleData = item.examples && item.examples.length > 0 ? item.examples[0] : null;
        
        // Create an Example object with the data from the API
        const example = new Example({
          input: exampleData?.input || '',
          actualOutput: exampleData?.actual_output || '',
          expectedOutput: exampleData?.expected_output || '',
          context: exampleData?.context || null,
          retrievalContext: exampleData?.retrieval_context || null,
          additionalMetadata: exampleData?.additional_metadata || {},
          toolsCalled: exampleData?.tools_called || null,
          expectedTools: exampleData?.expected_tools || null,
          exampleId: exampleData?.example_id || null,
          name: exampleData?.name || 'example',
          exampleIndex: exampleData?.example_index || 0,
          timestamp: exampleData?.created_at || new Date().toISOString(),
          traceId: item.result?.trace_id || null
        });
        
        // Create a ScoringResult using the builder pattern
        const scoringResult = ScoringResult.builder()
          .dataObject(example)
          .scorersData(item.result.scorers_data)
          .build();
        
        scoringResults.push(scoringResult);
      }
    }
    
    return scoringResults;
  }

  /**
   * Check the status of an evaluation run using the fetch endpoint.
   * This is a heuristic approach as the endpoint might return full results or status info.
   * @param projectName The name of the project
   * @param evalRunName The name of the evaluation run
   * @returns An object representing the status { status: string, progress: number, message: string }
   */
  public async checkEvalStatus(projectName: string, evalRunName: string): Promise<{ status: string; progress: number; message: string; error?: string }> {
    const requestBody: EvalRunRequestBody = {
        project_name: projectName,
        eval_name: evalRunName,
        judgment_api_key: this.judgmentApiKey,
    };

    try {
        const response = await axios.post<{ 
            status?: string;
            progress?: number;
            message?: string;
            error?: string;
            // Also handle case where full results are returned
            results?: any[]; 
            id?: string; 
        }>(JUDGMENT_EVAL_FETCH_API_URL, requestBody, {
            headers: this.getAuthHeaders(),
            // Add a shorter timeout for status checks?
            // timeout: 5000 
        });

        const data = response.data;

        // Check if the response looks like a status object
        if (data && typeof data.status === 'string') {
            return { 
                status: data.status || 'unknown',
                progress: typeof data.progress === 'number' ? data.progress : 0,
                message: data.message || '',
                error: data.error
            };
        } 
        // Check if the response looks like completed results (array format from pullEval)
        else if (Array.isArray(data) && data.length > 0 && data[0].results) {
             return {
                 status: 'completed',
                 progress: 100,
                 message: 'Evaluation completed.'
             };
        }
        // Check if response looks like completed results (single object format)
         else if (data && typeof data.id === 'string' && Array.isArray(data.results)) { // Adjust based on actual API response for single result fetch
             return {
                 status: 'completed',
                 progress: 100,
                 message: 'Evaluation completed.'
             };
         } 
         // Handle other potential responses or assume pending/unknown
         else {
            logger.warn(`Unexpected response format when checking status for ${evalRunName}:`, data);
            return { 
                status: 'unknown', 
                progress: 0, 
                message: 'Could not determine status from API response.'
             };
        }

    } catch (error) {
      // Don't throw here, return status indicating error
      let errorMessage = 'Failed to fetch evaluation status.';
      let status = 'error';
      if (axios.isAxiosError(error) && error.response?.status === 404) {
           status = 'not_found';
           errorMessage = 'Evaluation run not found.';
           logger.warn(`Evaluation run ${evalRunName} not found.`);
      } else {
          this.handleApiError(error, 'checkEvalStatus');
          errorMessage = `Error fetching status: ${String(error)}`;
      }
       return {
         status: status,
         progress: 0,
         message: errorMessage,
         error: String(error) // Include error string
       };
    }
  }

  /**
   * Wait for an async evaluation to complete and return the results
   * @param projectName The name of the project
   * @param evalRunName The name of the evaluation run
   * @param options Optional configuration for polling: intervalMs, maxAttempts, showProgress
   * @returns The evaluation results as ScoringResult[] or empty array on timeout/failure.
   */
  public async waitForEvaluation(
    projectName: string,
    evalRunName: string,
    options: {
      intervalMs?: number;
      maxAttempts?: number;
      showProgress?: boolean
    } = {}
  ): Promise<ScoringResult[]> {
    const { intervalMs = 5000, maxAttempts = 120, showProgress = true } = options; // Default: check every 5s for 10 mins

    let progressBar: cliProgress.SingleBar | undefined;
    if (showProgress) {
        progressBar = new cliProgress.SingleBar({
            format: `Waiting for ${colors.magenta(evalRunName)}... | ${colors.cyan('{bar}')} | {percentage}% || {status}`,
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true,
            clearOnComplete: false,
            stopOnComplete: true,
        }, cliProgress.Presets.shades_classic);
        progressBar.start(100, 0, { status: 'Initiating...' });
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const statusResult = await this.checkEvalStatus(projectName, evalRunName);
            const progress = Math.max(0, Math.min(100, statusResult.progress || 0)); // Clamp progress
            const statusText = statusResult.message || statusResult.status;

            if (progressBar) {
                progressBar.update(progress, { status: statusText });
            }

            if (statusResult.status === 'completed') {
                if (progressBar) {
                     progressBar.update(100, { status: colors.green('Completed! Fetching results...') });
                }
                // Fetch final results using pullEval
                const finalResults = await this.pullEvalResults(projectName, evalRunName);
                logger.info(`Evaluation run ${evalRunName} completed successfully.`);
                return finalResults;
            } else if (statusResult.status === 'error' || statusResult.status === 'failed') {
                 // Concatenate error details into a single message string
                 const errorMsg = `Evaluation run ${evalRunName} failed or encountered an error: ${statusResult.error ? String(statusResult.error) : statusResult.message}`;
                 logger.error(errorMsg);
                 if (progressBar) progressBar.stop();
                 // Pass only the combined message to the constructor
                 throw new JudgmentAPIError(errorMsg);
            } else if (statusResult.status === 'not_found') {
                const errorMsg = `Evaluation run ${evalRunName} not found.`;
                logger.error(errorMsg);
                if (progressBar) progressBar.stop();
                // Pass only the message to the constructor
                throw new JudgmentAPIError(errorMsg);
            }

            // Wait for the next interval
            await new Promise(resolve => setTimeout(resolve, intervalMs));

        } catch (error) {
             // Handle errors during the wait loop (e.g., network issues during checkEvalStatus)
             logger.error(`Error during waitForEvaluation loop (attempt ${attempt}): ${error}`);
             // Option: Rethrow immediately vs. retry vs. specific handling
             if (error instanceof JudgmentAPIError) { // If it was already a processed API error, rethrow
                 if (progressBar) progressBar.stop();
                 throw error;
             }
              // For other errors, wait and retry (up to maxAttempts)
             if (attempt === maxAttempts) {
                  if (progressBar) progressBar.stop();
                  throw new Error(`waitForEvaluation failed after ${maxAttempts} attempts: ${error}`);
             }
             // Still retryable, wait for interval
             await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    }

    // If loop finishes without completion or error
    if (progressBar) progressBar.stop();
    throw new Error(`Evaluation run ${evalRunName} did not complete after ${maxAttempts} attempts.`);
  }

  /**
   * Create a simple ASCII progress bar
   * @param percent The percentage to display (0-100)
   * @returns A string representing the progress bar
   */
  private _createProgressBar(percent: number): string {
    const width = 20; // Width of the progress bar
    const filled = Math.round(width * (percent / 100));
    const empty = width - filled;
    return `[${'#'.repeat(filled)}${'.'.repeat(empty)}] ${percent.toFixed(1)}%`;
  }

  // Keep helper methods private
  private getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.judgmentApiKey}`,
      'X-Organization-Id': this.organizationId,
    };
  }
  
  // Ensure this handles errors from Eval/Project API calls correctly
  private handleApiError(error: unknown, context: string): void {
    logger.error(`API Error during ${context}:`); 
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const response = axiosError.response;

      if (response) {
        logger.error(`Status: ${response.status} ${response.statusText}`);
        logger.debug('Response Data:', response.data); 
        if (response.status === 422) {
          logger.error('Validation Error Detail:', response.data);
        } else if (context === 'pullEval' && response.status === 404) { // Keep eval-specific handling
           logger.error(`Evaluation run not found.`);
        } else if (context.startsWith('delete') && response.status === 404) { // Keep generic delete handling
           logger.warn(`${context}: Resource not found, may have already been deleted.`);
        } 
      } else if (axiosError.request) {
        logger.error('No response received from server.');
      } else {
        logger.error(`Error setting up API request for ${context}`);
      }
    } else {
      logger.error(`Unexpected error during ${context}`);
    }
  }
}
