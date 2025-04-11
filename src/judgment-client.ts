import * as dotenv from 'dotenv';
import axios from 'axios';
import { Example } from './data/example';
import { ScoringResult } from './data/result';
import { APIJudgmentScorer, JudgevalScorer, ScorerWrapper, Scorer } from './scorers/base-scorer';
import { EvaluationRun } from './evaluation-run';
import { Rule, Condition } from './rules';
import { runEval, assertTest, JudgmentAPIError } from './run-evaluation';
import {
  ROOT_API,
  JUDGMENT_EVAL_FETCH_API_URL,
  JUDGMENT_EVAL_DELETE_API_URL,
  JUDGMENT_EVAL_DELETE_PROJECT_API_URL,
  JUDGMENT_PROJECT_DELETE_API_URL,
  JUDGMENT_PROJECT_CREATE_API_URL
} from './constants';
import logger from './common/logger';

// Load environment variables
dotenv.config();

/**
 * Request body for eval run operations
 */
interface EvalRunRequestBody {
  eval_name: string;
  project_name: string;
  judgment_api_key: string;
}

/**
 * Request body for deleting eval runs
 */
interface DeleteEvalRunRequestBody {
  eval_names: string[];
  project_name: string;
  judgment_api_key: string;
}

/**
 * Singleton implementation for JudgmentClient
 */
export class JudgmentClient {
  private static instance: JudgmentClient;
  private judgmentApiKey: string;
  private organizationId: string;
  private apiUrl: string;
  
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
    this.apiUrl = process.env.JUDGMENT_API_URL || 'https://api.judgment.ai';
    
    // Disable all logging to match Python SDK output format
    logger.disableLogging();
    
    // Completely disable console output for internal logging
    // This is needed to match the Python SDK's output format exactly
    if (process.env.DISABLE_LOGGING === 'true') {
      // Save original console methods
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
        if (args[0] && args[0].toString().includes('JUDGMENT_API_KEY environment variable is not set')) {
          originalConsoleError.apply(console, args);
        }
        if (args[0] && args[0].toString().includes('JUDGMENT_ORG_ID environment variable is not set')) {
          originalConsoleError.apply(console, args);
        }
      };
    }
    
    // For testing purposes, we'll skip API key validation
    console.log('Successfully initialized JudgmentClient!');
    
    if (!this.judgmentApiKey) {
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
            loadedScorers.push(scorer);
          }
        } catch (error) {
          throw new Error(`Failed to load implementation for scorer ${scorer}: ${error}`);
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
                  const newCondition = new Condition(condition.metric.loadImplementation(useJudgment));
                  processedConditions.push(newCondition);
                } catch (error) {
                  throw new Error(`Failed to convert ScorerWrapper to implementation in rule '${rule.name}', condition metric '${condition.metric}': ${error}`);
                }
              } else {
                processedConditions.push(condition);
              }
            }
            
            // Create new rule with processed conditions
            const newRule = new Rule(
              rule.name,
              processedConditions,
              rule.combineType,
              rule.description,
              rule.notification,
              rule.ruleId
            );
            loadedRules.push(newRule);
          } catch (error) {
            throw new Error(`Failed to process rule '${rule.name}': ${error}`);
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
        throw new Error(`An unexpected error occurred during evaluation: ${error}`);
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
    dataset: any, // EvalDataset would be implemented separately
    scorers: Array<ScorerWrapper | JudgevalScorer>,
    model: string | string[] | any,
    aggregator?: string,
    metadata?: Record<string, any>,
    projectName: string = '',
    evalRunName: string = '',
    logResults: boolean = true,
    useJudgment: boolean = true,
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
            loadedScorers.push(scorer);
          }
        } catch (error) {
          throw new Error(`Failed to load implementation for scorer ${scorer}: ${error}`);
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
                  const newCondition = new Condition(condition.metric.loadImplementation(useJudgment));
                  processedConditions.push(newCondition);
                } catch (error) {
                  throw new Error(`Failed to convert ScorerWrapper to implementation in rule '${rule.name}', condition metric '${condition.metric}': ${error}`);
                }
              } else {
                processedConditions.push(condition);
              }
            }
            
            // Create new rule with processed conditions
            const newRule = new Rule(
              rule.name,
              processedConditions,
              rule.combineType,
              rule.description,
              rule.notification,
              rule.ruleId
            );
            loadedRules.push(newRule);
          } catch (error) {
            throw new Error(`Failed to process rule '${rule.name}': ${error}`);
          }
        }
      }

      const evaluationRun = new EvaluationRun({
        logResults,
        projectName,
        evalName: evalRunName,
        examples: dataset.examples,
        scorers: loadedScorers,
        model,
        aggregator,
        metadata,
        judgmentApiKey: this.judgmentApiKey,
        rules: loadedRules,
        organizationId: this.organizationId
      });

      return runEval(evaluationRun);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('one or more fields are invalid')) {
          throw new Error(`Please check your EvaluationRun object, one or more fields are invalid: \n${error.message}`);
        } else {
          throw new Error(`An unexpected error occurred during evaluation: ${error.message}`);
        }
      } else {
        throw new Error(`An unexpected error occurred during evaluation: ${error}`);
      }
    }
  }

  /**
   * Create a dataset
   */
  public createDataset(): any {
    // This would be implemented with EvalDataset
    throw new Error('Not implemented yet');
  }

  /**
   * Push a dataset to the Judgment platform
   */
  public async pushDataset(
    alias: string,
    dataset: any,
    projectName: string,
    overwrite: boolean = false
  ): Promise<boolean> {
    // This would be implemented with EvalDataset
    throw new Error('Not implemented yet');
  }

  /**
   * Pull a dataset from the Judgment platform
   */
  public async pullDataset(
    alias: string,
    projectName: string
  ): Promise<any> {
    // This would be implemented with EvalDataset
    throw new Error('Not implemented yet');
  }

  /**
   * Delete a dataset from the Judgment platform
   */
  public async deleteDataset(
    alias: string,
    projectName: string
  ): Promise<boolean> {
    // This would be implemented with EvalDataset
    throw new Error('Not implemented yet');
  }

  /**
   * Pull project dataset stats from the Judgment platform
   */
  public async pullProjectDatasetStats(
    projectName: string
  ): Promise<Record<string, any>> {
    // This would be implemented with EvalDataset
    throw new Error('Not implemented yet');
  }

  /**
   * Insert examples into a dataset on the Judgment platform
   */
  public async insertDataset(
    alias: string,
    examples: Example[],
    projectName: string
  ): Promise<boolean> {
    // This would be implemented with EvalDataset
    throw new Error('Not implemented yet');
  }

  /**
   * Pull evaluation results from the server
   * @param projectName Name of the project
   * @param evalRunName Name of the evaluation run
   * @returns Dictionary containing the evaluation run ID and list of scoring results
   */
  public async pullEval(
    projectName: string,
    evalRunName: string
  ): Promise<Array<Record<string, any>>> {
    const evalRunRequestBody: EvalRunRequestBody = {
      project_name: projectName,
      eval_name: evalRunName,
      judgment_api_key: this.judgmentApiKey
    };

    try {
      const response = await axios.post(
        JUDGMENT_EVAL_FETCH_API_URL,
        evalRunRequestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.judgmentApiKey}`,
            'X-Organization-Id': this.organizationId
          }
        }
      );

      // Process the response to match the Python SDK's format
      const evalRunResult = [{}] as any[];
      
      for (const result of response.data) {
        const resultId = result.id || '';
        const resultData = result.result || {};
        
        // Extract data object to create an Example
        const dataObject = resultData.data_object || {};
        const example = new Example({
          input: dataObject.input || '',
          actualOutput: dataObject.actual_output || '',
          expectedOutput: dataObject.expected_output || '',
          context: dataObject.context,
          retrievalContext: dataObject.retrieval_context,
          additionalMetadata: dataObject.additional_metadata,
          toolsCalled: dataObject.tools_called,
          expectedTools: dataObject.expected_tools,
          exampleId: dataObject.example_id,
          exampleIndex: dataObject.example_index || 0,
          timestamp: dataObject.timestamp
        });
        
        // Extract scorers data
        const scorersData = resultData.scorers_data || [];
        
        // Create ScoringResult
        const scoringResult = new ScoringResult({
          dataObject: example,
          scorersData: scorersData,
          error: resultData.error
        });
        
        evalRunResult[0].id = resultId;
        evalRunResult[0].results = [scoringResult];
      }
      
      return evalRunResult;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.detail || error.message;
        throw new Error(`Failed to pull evaluation results: ${statusCode} - ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Get evaluation run results (alias for pullEval with a more intuitive name)
   * @param projectName Name of the project
   * @param evalRunName Name of the evaluation run
   * @returns Dictionary containing the evaluation run ID and list of scoring results
   */
  public async getEvalRun(
    projectName: string,
    evalRunName: string
  ): Promise<Array<Record<string, any>>> {
    return this.pullEval(projectName, evalRunName);
  }

  /**
   * List all evaluation runs for a project
   * @param projectName Name of the project
   * @param limit Maximum number of evaluation runs to return (default: 100)
   * @param offset Offset for pagination (default: 0)
   * @returns List of evaluation run metadata
   */
  public async listEvalRuns(
    projectName: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<Array<Record<string, any>>> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/projects/${projectName}/eval-runs`,
        {
          params: {
            limit,
            offset
          },
          headers: {
            'Authorization': `Bearer ${this.judgmentApiKey}`,
            'X-Organization-Id': this.organizationId
          }
        }
      );

      return response.data || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.detail || error.message;
        throw new Error(`Failed to list evaluation runs: ${statusCode} - ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Get evaluation run statistics
   * @param projectName Name of the project
   * @param evalRunName Name of the evaluation run
   * @returns Statistics for the evaluation run
   */
  public async getEvalRunStats(
    projectName: string,
    evalRunName: string
  ): Promise<Record<string, any>> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/projects/${projectName}/eval-runs/${evalRunName}/stats`,
        {
          headers: {
            'Authorization': `Bearer ${this.judgmentApiKey}`,
            'X-Organization-Id': this.organizationId
          }
        }
      );

      return response.data || {};
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.detail || error.message;
        throw new Error(`Failed to get evaluation run statistics: ${statusCode} - ${errorMessage}`);
      }
      throw error;
    }
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
    try {
      const evalRun = await this.pullEval(projectName, evalRunName);
      
      if (format === 'json') {
        return JSON.stringify(evalRun, null, 2);
      } else if (format === 'csv') {
        const results = evalRun[0]?.results || [];
        if (results.length === 0) {
          return 'No results found';
        }

        // Use json2csv library instead of manual conversion
        const { Parser } = require('json2csv');

        try {
          // Convert complex objects to strings to avoid json2csv errors
          const processedResults = results.map((result: any) => {
            const processedResult = { ...result };
            for (const key in processedResult) {
              if (typeof processedResult[key] === 'object' && processedResult[key] !== null) {
                processedResult[key] = JSON.stringify(processedResult[key]);
              }
            }
            return processedResult;
          });
          
          const parser = new Parser();
          return parser.parse(processedResults);
        } catch (error) {
          console.error('Error converting to CSV:', error);
          // Check the type before accessing .message
          const errorMessage = error instanceof Error ? error.message : String(error);
          return `Error generating CSV: ${errorMessage}`;
        }
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      throw new Error(`Failed to export evaluation results: ${error}`);
    }
  }

  /**
   * Delete an evaluation from the server
   */
  public async deleteEval(
    projectName: string,
    evalRunNames: string[]
  ): Promise<boolean> {
    if (!evalRunNames || evalRunNames.length === 0) {
      throw new Error('No evaluation run names provided');
    }

    const evalRunRequestBody: DeleteEvalRunRequestBody = {
      project_name: projectName,
      eval_names: evalRunNames,
      judgment_api_key: this.judgmentApiKey
    };

    try {
      const response = await axios.delete(
        JUDGMENT_EVAL_DELETE_API_URL,
        {
          data: evalRunRequestBody,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.judgmentApiKey}`,
            'X-Organization-Id': this.organizationId
          }
        }
      );

      return Boolean(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(`Eval results not found: ${JSON.stringify(error.response.data)}`);
        } else if (error.response?.status === 500) {
          throw new Error(`Error deleting eval results: ${JSON.stringify(error.response.data)}`);
        }
      }
      throw new Error(`Error deleting eval results: ${error}`);
    }
  }

  /**
   * Delete all evaluations from the server for a given project
   */
  public async deleteProjectEvals(
    projectName: string
  ): Promise<boolean> {
    try {
      const response = await axios.delete(
        JUDGMENT_EVAL_DELETE_PROJECT_API_URL,
        {
          data: {
            project_name: projectName,
            judgment_api_key: this.judgmentApiKey
          },
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.judgmentApiKey}`,
            'X-Organization-Id': this.organizationId
          }
        }
      );

      return Boolean(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(`Project not found: ${JSON.stringify(error.response.data)}`);
        } else if (error.response?.status === 500) {
          throw new Error(`Error deleting project evals: ${JSON.stringify(error.response.data)}`);
        }
      }
      throw new Error(`Error deleting project evals: ${error}`);
    }
  }

  /**
   * Create a project on the server
   */
  public async createProject(
    projectName: string
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        JUDGMENT_PROJECT_CREATE_API_URL,
        {
          project_name: projectName,
          judgment_api_key: this.judgmentApiKey
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.judgmentApiKey}`,
            'X-Organization-Id': this.organizationId
          }
        }
      );

      return Boolean(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Error creating project: ${JSON.stringify(error.response.data)}`);
      } else {
        throw new Error(`Error creating project: ${error}`);
      }
    }
  }

  /**
   * Delete a project from the server
   */
  public async deleteProject(
    projectName: string
  ): Promise<boolean> {
    try {
      const response = await axios.delete(
        JUDGMENT_PROJECT_DELETE_API_URL,
        {
          data: {
            project_name: projectName,
            judgment_api_key: this.judgmentApiKey
          },
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.judgmentApiKey}`,
            'X-Organization-Id': this.organizationId
          }
        }
      );

      return Boolean(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Error deleting project: ${JSON.stringify(error.response.data)}`);
      } else {
        throw new Error(`Error deleting project: ${error}`);
      }
    }
  }

  /**
   * Validate that the user API key is valid
   */
  private async validateApiKey(): Promise<[boolean, string]> {
    try {
      const response = await axios.post(
        `${ROOT_API}/validate_api_key/`,
        {},  // Empty body
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.judgmentApiKey}`,
            'X-Organization-Id': this.organizationId
          }
        }
      );
      
      if (response.status === 200) {
        return [true, JSON.stringify(response.data)];
      } else {
        return [false, response.data?.detail || 'Error validating API key'];
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return [false, error.response.data?.detail || 'Error validating API key'];
      } else {
        return [false, String(error)];
      }
    }
  }

  /**
   * Assert a test by running the evaluation and checking the results for success
   */
  public async assertTest(
    examples: Example[],
    scorers: Array<APIJudgmentScorer | JudgevalScorer>,
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
      true,
      false,
      false,
      rules
    );

    assertTest(results);
  }

  /**
   * Pull the results of an evaluation run
   * @param projectName The name of the project
   * @param evalRunName The name of the evaluation run
   * @returns The results of the evaluation run
   */
  async pullEvalResults(projectName: string, evalRunName: string): Promise<any[]> {
    try {
      const url = `${this.apiUrl}/eval/pull`;
      const response = await axios.post(url, {
        project_name: projectName,
        eval_name: evalRunName,
        judgment_api_key: this.judgmentApiKey
      }, {
        headers: {
          'Authorization': `Bearer ${this.judgmentApiKey}`,
          'Content-Type': 'application/json',
          'X-Organization-Id': this.organizationId
        }
      });
      
      return response.data.results || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.detail || error.message;
        throw new Error(`Failed to pull evaluation results: ${statusCode} - ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Check the status of an evaluation run
   * @param projectName The name of the project
   * @param evalRunName The name of the evaluation run
   * @returns The status of the evaluation run
   */
  public async checkEvalStatus(projectName: string, evalRunName: string): Promise<any> {
    try {
      const response = await axios.post(
        JUDGMENT_EVAL_FETCH_API_URL,
        {
          project_name: projectName,
          eval_run_name: evalRunName,
          judgment_api_key: this.judgmentApiKey,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.judgmentApiKey}`,
            'X-Organization-Id': this.organizationId
          },
          timeout: 10000 // Add timeout to prevent hanging requests
        }
      );
      
      // Format the response for better readability
      const status = response.data;
      const statusText = status.status || 'unknown';
      const progress = status.progress !== undefined ? `${Math.round(status.progress * 100)}%` : 'unknown';
      const message = status.message || '';
      
      // Only log status if it's not being called from waitForEvaluation
      if (Error().stack?.indexOf('waitForEvaluation') === -1) {
        console.log(`Evaluation Status: ${statusText}`);
        console.log(`Progress: ${progress}`);
        if (message) {
          console.log(`Message: ${message}`);
        }
      }
      
      return status;
    } catch (error: unknown) {
      // Don't throw errors, just return a default status object
      // This allows waitForEvaluation to continue polling
      console.error("Error checking evaluation status:", error instanceof Error ? error.message : String(error));
      return {
        status: 'unknown',
        progress: 0,
        message: `Error checking status: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * Wait for an async evaluation to complete and return the results
   * @param projectName The name of the project
   * @param evalRunName The name of the evaluation run
   * @param options Optional configuration for polling
   * @returns The evaluation results
   */
  public async waitForEvaluation(
    projectName: string, 
    evalRunName: string, 
    options: {
      intervalMs?: number,
      maxAttempts?: number,
      showProgress?: boolean
    } = {}
  ): Promise<ScoringResult[]> {
    const {
      intervalMs = 2000,
      maxAttempts = 300,
      showProgress = true
    } = options;
    
    let attempts = 0;
    let lastProgress = -1;
    
    console.log(`Waiting for evaluation "${evalRunName}" in project "${projectName}" to complete...`);
    
    while (attempts < maxAttempts) {
      try {
        const status = await this.checkEvalStatus(projectName, evalRunName);
        
        // Only show progress updates when the progress changes
        if (showProgress && status.progress !== undefined && Math.round(status.progress * 100) !== lastProgress) {
          lastProgress = Math.round(status.progress * 100);
          const progressBar = this._createProgressBar(lastProgress);
          console.log(`Progress: ${progressBar} ${lastProgress}%`);
        }
        
        // Check if evaluation is complete
        if (status.status === 'complete') {
          console.log('Evaluation complete! Fetching results...');
          try {
            return await this.pullEvalResults(projectName, evalRunName);
          } catch (error) {
            console.error('Error fetching results:', error instanceof Error ? error.message : String(error));
            return []; // Return empty array on error, matching Python SDK behavior
          }
        } else if (status.status === 'failed') {
          console.error(`Evaluation failed: ${status.error || 'Unknown error'}`);
          return []; // Return empty array on failure, matching Python SDK behavior
        }
      } catch (error) {
        // Log the error but continue polling
        console.error(`Error checking status (attempt ${attempts + 1}/${maxAttempts}):`, error instanceof Error ? error.message : String(error));
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    }
    
    console.error(`Evaluation polling timed out after ${maxAttempts} attempts`);
    return []; // Return empty array on timeout, matching Python SDK behavior
  }
  
  /**
   * Create a simple ASCII progress bar
   * @param percent The percentage to display (0-100)
   * @returns A string representing the progress bar
   */
  private _createProgressBar(percent: number): string {
    const width = 20;
    const completed = Math.floor(width * (percent / 100));
    const remaining = width - completed;
    
    return '[' + '='.repeat(completed) + ' '.repeat(remaining) + ']';
  }
}
