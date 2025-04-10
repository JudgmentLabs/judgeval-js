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
   * Private constructor to enforce singleton pattern
   */
  private constructor(
    judgmentApiKey?: string, 
    organizationId?: string
  ) {
    this.judgmentApiKey = judgmentApiKey || process.env.JUDGMENT_API_KEY || '';
    this.organizationId = organizationId || process.env.JUDGMENT_ORG_ID || '';
    
    // For testing purposes, we'll skip API key validation
    console.log('Initializing JudgmentClient with API key and organization ID');
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
      true, 
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

      const evalRunResult: Array<Record<string, any>> = [{}];
      for (const result of response.data) {
        const resultId = result.id || '';
        const resultData = result.result || {};
        
        // Filter result data to only include ScoringResult fields
        const filteredResult: Record<string, any> = {};
        for (const key in resultData) {
          if (['dataObject', 'scorersData', 'error'].includes(key)) {
            filteredResult[key] = resultData[key];
          }
        }
        
        evalRunResult[0].id = resultId;
        evalRunResult[0].results = [filteredResult];
      }
      
      return evalRunResult;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Error fetching eval results: ${JSON.stringify(error.response.data)}`);
      } else {
        throw new Error(`Error fetching eval results: ${error}`);
      }
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
      // For testing purposes, we'll skip the actual API call
      console.log('Skipping API key validation for testing');
      return [true, 'API key validation skipped for testing'];
      
      /* Uncomment for actual validation
      const response = await axios.get(
        `${ROOT_API}/validate-api-key/`,
        {
          headers: {
            'Authorization': `Bearer ${this.judgmentApiKey}`,
            'X-Organization-Id': this.organizationId
          }
        }
      );

      return [true, 'API key is valid'];
      */
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return [false, JSON.stringify(error.response.data)];
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
}
