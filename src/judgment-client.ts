import * as dotenv from 'dotenv';
import axios from 'axios';
import { Example } from './data/example.js';
import { ScoringResult } from './data/result.js';
import { APIJudgmentScorer, JudgevalScorer, ScorerWrapper, Scorer } from './scorers/base-scorer.js';
import { EvaluationRun } from './evaluation-run.js';
import { Rule, Condition } from './rules.js';
import { runEval, assertTest, JudgmentAPIError } from './run-evaluation.js';
import {
  ROOT_API,
  JUDGMENT_EVAL_FETCH_API_URL,
  JUDGMENT_EVAL_DELETE_API_URL,
  JUDGMENT_EVAL_DELETE_PROJECT_API_URL,
  JUDGMENT_PROJECT_DELETE_API_URL,
  JUDGMENT_PROJECT_CREATE_API_URL
} from './constants.js';
import logger from './common/logger-instance.js';

// Load environment variables
dotenv.config();

/**
 * Request body for eval run operations (fetch/pull)
 */
interface EvalRunRequestBody {
  eval_name: string;
  project_name: string;
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
            // Assuming scorers passed are already JudgevalScorer or APIJudgmentScorer
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
                    const loadedMetric = condition.metric.loadImplementation(useJudgment);
                    const newCondition = new Condition(loadedMetric);
                    Object.assign(newCondition, { ...condition, metric: loadedMetric });
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
        examples: dataset.examples, // Assuming dataset has an 'examples' property
        scorers: loadedScorers,
        model,
        aggregator,
        metadata,
        judgmentApiKey: this.judgmentApiKey,
        rules: loadedRules,
        organizationId: this.organizationId
      });

       // Assuming override=false, ignoreErrors=true, asyncExecution=false as defaults for evaluateDataset
      return runEval(evaluationRun, false, true, false);
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
   * @returns Array containing one object with 'id' and 'results' (list of ScoringResult)
   */
  public async pullEval(
    projectName: string,
    evalRunName: string // Consistent parameter name, but API uses eval_name
  ): Promise<Array<Record<string, any | ScoringResult[]>>> {
    const evalRunRequestBody: EvalRunRequestBody = {
      project_name: projectName,
      eval_name: evalRunName, // Use eval_name in the body for the API
      judgment_api_key: this.judgmentApiKey
    };

    try {
      const response = await axios.post(
        JUDGMENT_EVAL_FETCH_API_URL, // Use constant
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
      // Python returns [{ 'id': ..., 'results': [ScoringResult, ...]}]
      // The API response is a list of results, each with an 'id' and 'result'
      if (!Array.isArray(response.data) || response.data.length === 0) {
        return [{ id: '', results: [] }]; // Return empty structure if no data
      }

      const evalRunResult = { id: '', results: [] as ScoringResult[] };
      evalRunResult.id = response.data[0]?.id || ''; // Assume ID is same for all results in run

      for (const result of response.data) {
        const resultData = result.result || {};
        const dataObject = resultData.data_object || {};

        // Create Example from data_object
        const example = new Example({
          input: dataObject.input,
          actualOutput: dataObject.actual_output,
          expectedOutput: dataObject.expected_output,
          context: dataObject.context,
          retrievalContext: dataObject.retrieval_context,
          additionalMetadata: dataObject.additional_metadata,
          toolsCalled: dataObject.tools_called,
          expectedTools: dataObject.expected_tools,
          exampleId: dataObject.example_id,
          exampleIndex: dataObject.example_index,
          timestamp: dataObject.timestamp
        });

        // Create ScoringResult
        const scoringResult = new ScoringResult({
          dataObject: example,
          scorersData: resultData.scorers_data || [],
          error: resultData.error
        });

        evalRunResult.results.push(scoringResult);
      }

      return [evalRunResult]; // Wrap in array to match Python return type [{...}]
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.detail || error.message;
        throw new Error(`Failed to pull evaluation results: ${statusCode} - ${errorMessage}`);
      }
       if (error instanceof Error) {
           throw new Error(`Failed to pull evaluation results: ${error.message}`);
       }
       throw new Error(`Failed to pull evaluation results: ${String(error)}`);
    }
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
      // Use ROOT_API for the base URL
      const url = `${ROOT_API}/projects/${projectName}/eval-runs`;
      const response = await axios.get(
        url,
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
       if (error instanceof Error) {
            throw new Error(`Failed to list evaluation runs: ${error.message}`);
       }
       throw new Error(`Failed to list evaluation runs: ${String(error)}`);
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
      // Use ROOT_API for the base URL
      const url = `${ROOT_API}/projects/${projectName}/eval-runs/${evalRunName}/stats`;
      const response = await axios.get(
         url,
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
       if (error instanceof Error) {
           throw new Error(`Failed to get evaluation run statistics: ${error.message}`);
       }
       throw new Error(`Failed to get evaluation run statistics: ${String(error)}`);
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
      const evalRunArray = await this.pullEval(projectName, evalRunName);
      const evalRunData = evalRunArray[0]; // Get the first element containing id and results

      if (!evalRunData || !evalRunData.results) {
         return format === 'json' ? JSON.stringify([], null, 2) : 'No results found';
      }

      if (format === 'json') {
        // Return the whole structure including ID and results array
        return JSON.stringify(evalRunData, null, 2);
      } else if (format === 'csv') {
        const results = evalRunData.results;
        if (!Array.isArray(results) || results.length === 0) {
          return 'No results found';
        }

        // Use csv-writer instead of json2csv
        let createObjectCsvStringifier;
        try {
           // Use dynamic import() for ES Modules
           const csvWriterModule = await import('csv-writer');
           createObjectCsvStringifier = csvWriterModule.createObjectCsvStringifier;
           if (!createObjectCsvStringifier) { // Check if the function exists
              throw new Error("Could not load createObjectCsvStringifier from csv-writer");
           }
        } catch (e) {
           // Provide a more helpful error message
           const errorMsg = e instanceof Error ? e.message : String(e);
           // Update error message to reflect import() failure
           console.error(`Failed to dynamically import 'csv-writer': ${errorMsg}. Ensure it's installed (\`npm install csv-writer\`).`);
           throw new Error("The 'csv-writer' package is required for CSV export but failed to load dynamically.");
        }


        try {
          // Flatten the structure slightly for better CSV output
          const processedResults = results.map((result: ScoringResult) => {
             // Flatten dataObject properties and scorersData
             const flatResult: Record<string, any> = {};
             flatResult.eval_run_id = evalRunData.id; // Add eval run ID

             // Flatten dataObject
             if (result.dataObject) {
               for (const [key, value] of Object.entries(result.dataObject)) {
                 // Prefix with 'data_' to avoid potential clashes
                 flatResult[`data_${key}`] = (typeof value === 'object' && value !== null) ? JSON.stringify(value) : value;
               }
             }

             // Flatten scorersData - creates columns like scorer_0_name, scorer_0_score, etc.
             if (Array.isArray(result.scorersData)) {
                result.scorersData.forEach((scorerData, index) => {
                    flatResult[`scorer_${index}_name`] = scorerData.name;
                    flatResult[`scorer_${index}_score`] = (typeof scorerData.score === 'object' && scorerData.score !== null) ? JSON.stringify(scorerData.score) : scorerData.score;
                    flatResult[`scorer_${index}_error`] = scorerData.error;
                    // Add other scorer fields if necessary, e.g., metadata
                    if (scorerData.additional_metadata) {
                         flatResult[`scorer_${index}_metadata`] = JSON.stringify(scorerData.additional_metadata);
                    }
                });
             }

             flatResult.error = result.error; // Top-level error for the example processing
             return flatResult;
           });

           // Define headers dynamically based on the keys of the first processed result
           if (processedResults.length === 0) {
                return 'No data to export after processing.'; // Handle case with no valid results after processing
           }
           const headers = Object.keys(processedResults[0]).map(key => ({ id: key, title: key }));

           const csvStringifier = createObjectCsvStringifier({
               header: headers
           });

           // Generate CSV string (header + records)
           return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(processedResults);

        } catch (error) {
          console.error('Error converting to CSV:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          return `Error generating CSV: ${errorMessage}`;
        }
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
       if (error instanceof Error) {
           throw new Error(`Failed to export evaluation results: ${error.message}`);
       }
       throw new Error(`Failed to export evaluation results: ${String(error)}`);
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

    // Body matches Python's structure for this endpoint
    const evalRunRequestBody: DeleteEvalRunRequestBody = {
      project_name: projectName,
      eval_names: evalRunNames,
      judgment_api_key: this.judgmentApiKey // Required by this specific API endpoint
    };

    try {
      const response = await axios.delete(
        JUDGMENT_EVAL_DELETE_API_URL, // Use constant
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
         const status = error.response?.status;
         const data = error.response?.data;
        if (status === 404) {
          throw new Error(`Eval results not found: ${JSON.stringify(data)}`);
        } else if (status === 500) {
          throw new Error(`Error deleting eval results: ${JSON.stringify(data)}`);
        } else {
           throw new Error(`Error deleting eval results (${status}): ${JSON.stringify(data)}`);
        }
      }
      // Rethrow original or wrapped error
       if (error instanceof Error) {
          throw new Error(`Error deleting eval results: ${error.message}`);
       }
       throw new Error(`Error deleting eval results: ${String(error)}`);
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
        JUDGMENT_EVAL_DELETE_PROJECT_API_URL, // Use constant
        {
          // Remove judgment_api_key from body to match Python (uses header auth)
          data: {
            project_name: projectName,
          },
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.judgmentApiKey}`,
            'X-Organization-Id': this.organizationId
          }
        }
      );

      // Python returns response.json(), check if TS response needs similar handling
      return Boolean(response.data); // Assuming response.data indicates success
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data;
        if (status === 404) {
          // Assuming 404 might mean project not found or no evals to delete
          console.warn(`Project '${projectName}' not found or no evals to delete.`);
          return false; // Or true depending on desired idempotency behavior
        } else if (status === 500) {
          throw new Error(`Error deleting project evals: ${JSON.stringify(data)}`);
        } else {
           throw new Error(`Error deleting project evals (${status}): ${JSON.stringify(data)}`);
        }
      }
       if (error instanceof Error) {
           throw new Error(`Error deleting project evals: ${error.message}`);
       }
       throw new Error(`Error deleting project evals: ${String(error)}`);
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
        JUDGMENT_PROJECT_CREATE_API_URL, // Use constant
        // Remove judgment_api_key from body to match Python (uses header auth)
        {
          project_name: projectName,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.judgmentApiKey}`,
            'X-Organization-Id': this.organizationId
          }
        }
      );

      // Python returns response.json(), check if TS response needs similar handling
      return Boolean(response.data); // Assuming response.data indicates success
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
         // Check for specific conflict error (e.g., 409) if API provides it
         if (error.response.status === 409) {
              console.warn(`Project '${projectName}' already exists.`);
              return false; // Or true if idempotent creation is desired
         }
        throw new Error(`Error creating project (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      } else if (error instanceof Error) {
        throw new Error(`Error creating project: ${error.message}`);
      } else {
        throw new Error(`Error creating project: ${String(error)}`);
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
        JUDGMENT_PROJECT_DELETE_API_URL, // Use constant
        {
          // Remove judgment_api_key from body to match Python (uses header auth)
          data: {
            project_name: projectName,
          },
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.judgmentApiKey}`,
            'X-Organization-Id': this.organizationId
          }
        }
      );

       // Python returns response.json(), check if TS response needs similar handling
      return Boolean(response.data); // Assuming response.data indicates success
    } catch (error) {
       if (axios.isAxiosError(error) && error.response) {
          if (error.response.status === 404) {
               console.warn(`Project '${projectName}' not found for deletion.`);
               return false; // Or true depending on desired idempotency
          }
         throw new Error(`Error deleting project (${error.response.status}): ${JSON.stringify(error.response.data)}`);
       } else if (error instanceof Error) {
         throw new Error(`Error deleting project: ${error.message}`);
       } else {
         throw new Error(`Error deleting project: ${String(error)}`);
       }
    }
  }

  /**
   * Validate that the user API key is valid
   */
  private async validateApiKey(): Promise<[boolean, string]> {
    try {
      const response = await axios.post(
        `${ROOT_API}/validate_api_key/`, // Use ROOT_API
        {},  // Empty body
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.judgmentApiKey}`,
            // Removed 'X-Organization-Id' header to match Python for this specific endpoint
          }
        }
      );

      if (response.status === 200) {
        return [true, JSON.stringify(response.data)];
      } else {
        // Status might be non-200 but still valid JSON error response
        return [false, response.data?.detail || `Error validating API key (Status: ${response.status})`];
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return [false, error.response.data?.detail || `Error validating API key (Status: ${error.response.status})`];
      } else if (error instanceof Error) {
         return [false, `Error validating API key: ${error.message}`];
      }
       else {
        return [false, `Unknown error validating API key: ${String(error)}`];
      }
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
   * @returns The results of the evaluation run as ScoringResult[] or empty array on error/no results.
   */
  async pullEvalResults(projectName: string, evalRunName: string): Promise<ScoringResult[]> {
    try {
      const evalRunArray = await this.pullEval(projectName, evalRunName);
      // pullEval returns [{ id: ..., results: [...] }], extract results
      return evalRunArray[0]?.results || [];
    } catch (error) {
       // Log error but return empty array to allow waitForEvaluation to potentially retry
       logger.error(`Failed to pull evaluation results for '${evalRunName}': ${error instanceof Error ? error.message : String(error)}`);
       return [];
    }
  }

  /**
   * Check the status of an evaluation run using the fetch endpoint.
   * This is a heuristic approach as the endpoint might return full results or status info.
   * @param projectName The name of the project
   * @param evalRunName The name of the evaluation run
   * @returns An object representing the status { status: string, progress: number, message: string }
   */
  public async checkEvalStatus(projectName: string, evalRunName: string): Promise<{ status: string; progress: number; message: string; error?: string }> {
     // Using 'eval_name' in body for consistency with pullEval/fetch endpoint.
    const requestBody: EvalRunRequestBody = {
        project_name: projectName,
        eval_name: evalRunName, // Use 'eval_name'
        judgment_api_key: this.judgmentApiKey,
    };

    try {
      const response = await axios.post(
        JUDGMENT_EVAL_FETCH_API_URL, // Use fetch URL
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.judgmentApiKey}`,
            'X-Organization-Id': this.organizationId
          },
          timeout: 15000 // Slightly increased timeout for status checks
        }
      );

       // Interpret response: API might return status object or full results array
       let statusData: any = { status: 'unknown', progress: 0, message: '' };

       if (Array.isArray(response.data)) {
           // If it's an array, assume results are complete unless explicitly stated otherwise
           if (response.data.length > 0 && response.data[0]?.result?.status) {
                // Check if the first result object contains status info
               statusData = response.data[0].result; // Assuming status is within the 'result' field
           } else if (response.data.length > 0) {
               // Assume complete if we get results array without specific status fields
               statusData = { status: 'complete', progress: 1.0, message: 'Results received' };
           } else {
                // Empty array might mean still processing or no results yet
               statusData = { status: 'processing', progress: 0, message: 'Waiting for results...' };
           }
       } else if (typeof response.data === 'object' && response.data !== null && response.data.status) {
           // Might be a direct status object from the API
           statusData = response.data;
       } else {
           // Unexpected response format
           statusData = { status: 'unknown', progress: 0, message: `Unexpected response format: ${JSON.stringify(response.data)}` };
       }

      // Normalize the progress value
      let progress = 0;
      if (statusData.progress !== undefined && statusData.progress !== null) {
          const parsedProgress = parseFloat(statusData.progress);
          if (!isNaN(parsedProgress)) {
              progress = Math.max(0, Math.min(1, parsedProgress)); // Ensure progress is between 0 and 1
          }
      }

      const normalizedStatus = {
          status: statusData.status || 'unknown',
          progress: progress,
          message: statusData.message || '',
          error: statusData.error // Include error field if present
      };

      // Only log status if it's not being called from waitForEvaluation
      // Check stack trace for caller function name
      const stack = new Error().stack;
      const isCalledByWaitForEvaluation = stack?.includes('waitForEvaluation');

      if (!isCalledByWaitForEvaluation) {
          // Use logger for status updates when called directly
          logger.info(`Evaluation Status: ${normalizedStatus.status}`);
          logger.info(`Progress: ${Math.round(normalizedStatus.progress * 100)}%`);
          if (normalizedStatus.message) {
              logger.info(`Message: ${normalizedStatus.message}`);
          }
           if (normalizedStatus.error) {
              logger.error(`Error in status: ${normalizedStatus.error}`);
          }
      }

      return normalizedStatus;
    } catch (error: unknown) {
      // Don't throw errors from status check, just return default 'unknown' status
      // This allows waitForEvaluation to continue polling even on transient network issues
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error checking evaluation status for '${evalRunName}': ${errorMessage}`);
      return {
        status: 'unknown',
        progress: 0,
        message: `Error checking status: ${errorMessage}`
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
      intervalMs?: number,
      maxAttempts?: number,
      showProgress?: boolean
    } = {}
  ): Promise<ScoringResult[]> {
    const {
      intervalMs = 3000,  // Slightly longer interval
      maxAttempts = 200, // ~10 minutes total wait time (200 * 3s)
      showProgress = true
    } = options;

    let attempts = 0;
    let lastProgressPercent = -1;
    let lastStatus = '';

    if (showProgress) {
        // Use logger for initial message
        logger.info(`Waiting for evaluation "${evalRunName}" in project "${projectName}" to complete...`);
    }

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const status = await this.checkEvalStatus(projectName, evalRunName); // Call internal status check
        const currentProgressPercent = Math.round(status.progress * 100);

        // Show progress/status updates only when they change significantly
        if (showProgress && (currentProgressPercent !== lastProgressPercent || status.status !== lastStatus)) {
           const progressBar = this._createProgressBar(currentProgressPercent >= 0 ? currentProgressPercent : 0);
           // Use process.stdout.write to potentially overwrite the line (works best in standard terminals)
           process.stdout.write('\rAttempt ' + attempts + '/' + maxAttempts + ' | Status: ' + status.status + ' | Progress: ' + progressBar + ' ' + currentProgressPercent + '% ');
           lastProgressPercent = currentProgressPercent;
           lastStatus = status.status;
        }

        // Check evaluation status
        if (status.status === 'complete') {
           if (showProgress) {
               process.stdout.write('\n'); // Keep direct console output for progress bar newline
               // Use logger for status update
               logger.info('Evaluation complete! Fetching results...');
           }
          try {
            // Use the dedicated results fetching method
            const results = await this.pullEvalResults(projectName, evalRunName);
            if (results.length > 0) {
                // Use logger for status update
                logger.info(`Successfully fetched ${results.length} results.`);
                return results;
            } else {
                 // If complete status but no results, might be an issue. Log and return empty.
                 logger.warn(`Evaluation reported complete, but no results were fetched for '${evalRunName}'.`);
                 return [];
            }
          } catch (fetchError) {
            if (showProgress) process.stdout.write('\n'); // Keep direct console output
            logger.error(`Error fetching results after completion for '${evalRunName}': ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
            return []; // Return empty array on error
          }
        } else if (status.status === 'failed') {
           if (showProgress) process.stdout.write('\n'); // Keep direct console output
           logger.error(`Evaluation failed for '${evalRunName}': ${status.error || status.message || 'Unknown error'}`);
          return []; // Return empty array on failure
        } else if (status.status === 'unknown') {
             // Log unknown status but continue polling
             // Avoid flooding logs if status remains unknown
             if (lastStatus !== 'unknown') {
                 if (showProgress) process.stdout.write('\n'); // Keep direct console output
                 logger.warn(`Evaluation status unknown for '${evalRunName}' (attempt ${attempts}). Retrying...`);
                 lastProgressPercent = -1; // Reset progress display
             }
             lastStatus = 'unknown';
         } else {
              // Still processing (e.g., 'processing', 'running', 'pending')
              lastStatus = status.status;
         }
      } catch (error) {
        // Log the error but continue polling (checkEvalStatus should handle internal errors gracefully)
        if (showProgress) process.stdout.write('\n'); // Keep direct console output
        logger.error(`Error during status check loop (attempt ${attempts}/${maxAttempts}): ${error instanceof Error ? error.message : String(error)}`);
         lastProgressPercent = -1; // Reset progress display
         lastStatus = 'error_in_loop'; // Indicate issue in the loop itself
      }

      // Wait before next poll only if not completed/failed
      if (lastStatus !== 'complete' && lastStatus !== 'failed') {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
      } else {
           // Break loop if already completed or failed to avoid unnecessary delay
           break;
      }
    } // End while loop

    // If loop finished without completing/failing
    if (lastStatus !== 'complete' && lastStatus !== 'failed') {
        if (showProgress) process.stdout.write('\n'); // Keep direct console output
        logger.error(`Evaluation polling timed out after ${attempts} attempts for "${evalRunName}". Last known status: ${lastStatus}`);
        return []; // Return empty array on timeout
    }

    // Should technically be unreachable if break conditions work, but safeguard return
    return [];
  }

  /**
   * Create a simple ASCII progress bar
   * @param percent The percentage to display (0-100)
   * @returns A string representing the progress bar
   */
  private _createProgressBar(percent: number): string {
    const width = 25; // Slightly wider bar
    // Clamp percent between 0 and 100
    const clampedPercent = Math.max(0, Math.min(100, percent));
    const completed = Math.round(width * (clampedPercent / 100)); // Use round for potentially smoother look
    const remaining = width - completed;

    return '[' + '#'.repeat(completed) + '-'.repeat(remaining) + ']'; // Use different chars
  }
}
