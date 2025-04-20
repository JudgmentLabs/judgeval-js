import { log, info, warn, error } from '../../../common/logger.js';
import { JudgevalScorer } from '../../base-scorer.js';
import { Example } from '../../../data/example.js';
import { ScorerData } from '../../../data/result.js';
import { APIScorer } from '../../../constants.js';
import { AnswerCorrectnessTemplate, ACVerdict, StatementsSchema, VerdictsSchema, ReasonSchema } from './prompts.js';
import { Judge, createJudge } from '../../../judges/index.js';
import axios from 'axios';

// Required parameters for this scorer
const requiredParams = ['input', 'actualOutput', 'expectedOutput'];

/**
 * Answer Correctness Scorer
 * 
 * This scorer evaluates whether the actual output correctly represents 
 * the expected output by extracting statements from the expected output
 * and checking if they are correctly represented in the actual output.
 */
export class AnswerCorrectnessScorer extends JudgevalScorer {
  private model: Judge;
  private usingNativeModel: boolean;
  private statements?: string[];
  private verdicts?: ACVerdict[];
  evaluation_cost?: number;
  reason?: string;

  /**
   * Constructor for AnswerCorrectnessScorer
   * @param threshold Minimum score to consider the evaluation successful (default: 0.5)
   * @param model LLM to use for evaluation (string or Judge instance)
   * @param include_reason Whether to generate a reason for the score
   * @param async_mode Whether to use asynchronous evaluation
   * @param strict_mode If true, sets threshold to 1.0 (requiring perfect match)
   * @param verbose_mode Enables detailed logging
   * @param user Optional user identifier for the LLM
   * @param additional_metadata Additional metadata to include in the result
   */
  constructor(
    threshold: number = 0.5,
    model?: string | Judge,
    include_reason: boolean = true,
    async_mode: boolean = true,
    strict_mode: boolean = false,
    verbose_mode: boolean = true,
    user?: string,
    additional_metadata?: Record<string, any>
  ) {
    super(
      APIScorer.ANSWER_CORRECTNESS,
      strict_mode ? 1.0 : threshold,
      additional_metadata,
      include_reason,
      async_mode,
      strict_mode,
      verbose_mode
    );
    
    info(`Initializing AnswerCorrectnessScorer with threshold=${this.threshold}, model=${model}, strict_mode=${strict_mode}`);
    
    const { judge, usingNativeModel } = createJudge(model, user);
    this.model = judge;
    this.usingNativeModel = usingNativeModel;
    this.evaluation_model = this.model.getModelName();
    
    log(`Using model: ${this.evaluation_model}`);
  }

  /**
   * Get statements from expected output asynchronously
   */
  private async _aGetStatements(expectedOutput: string | string[]): Promise<string[]> {
    log("Getting statements asynchronously");
    
    // Handle string array
    const expectedOutputStr = Array.isArray(expectedOutput) ? expectedOutput.join('\n') : expectedOutput;
    
    const prompt = AnswerCorrectnessTemplate.deduceStatements(expectedOutputStr);
    
    try {
      const response = await this.model.aGenerate(prompt);
      
      // Parse the response
      try {
        const jsonResponse = JSON.parse(response);
        const parsed = StatementsSchema.safeParse(jsonResponse);
        
        if (parsed.success) {
          return parsed.data.statements;
        } else {
          // Fallback to direct access if schema validation fails
          warn("Schema validation failed, falling back to raw response parsing");
          if (jsonResponse.statements && Array.isArray(jsonResponse.statements)) {
            return jsonResponse.statements;
          }
        }
      } catch (parseError) {
        warn(`Error parsing JSON response: ${parseError}`);
        // Try to extract JSON from the response text
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const extractedJson = JSON.parse(jsonMatch[0]);
            if (extractedJson.statements && Array.isArray(extractedJson.statements)) {
              return extractedJson.statements;
            }
          } catch (e) {
            error(`Failed to extract JSON from response: ${e}`);
          }
        }
      }
      
      // If all parsing attempts fail, return empty array
      error("Failed to parse statements from model response");
      return [];
    } catch (e) {
      error(`Error getting statements: ${e}`);
      return [];
    }
  }

  /**
   * Get statements from expected output synchronously
   */
  private _getStatements(expectedOutput: string | string[]): string[] {
    // Handle string array
    const expectedOutputStr = Array.isArray(expectedOutput) ? expectedOutput.join('\n') : expectedOutput;
    
    const prompt = AnswerCorrectnessTemplate.deduceStatements(expectedOutputStr);
    
    try {
      const response = this.model.generate(prompt);
      
      // Parse the response
      try {
        const jsonResponse = JSON.parse(response);
        const parsed = StatementsSchema.safeParse(jsonResponse);
        
        if (parsed.success) {
          return parsed.data.statements;
        } else {
          // Fallback to direct access if schema validation fails
          warn("Schema validation failed, falling back to raw response parsing");
          if (jsonResponse.statements && Array.isArray(jsonResponse.statements)) {
            return jsonResponse.statements;
          }
        }
      } catch (parseError) {
        warn(`Error parsing JSON response: ${parseError}`);
        // Try to extract JSON from the response text
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const extractedJson = JSON.parse(jsonMatch[0]);
            if (extractedJson.statements && Array.isArray(extractedJson.statements)) {
              return extractedJson.statements;
            }
          } catch (e) {
            error(`Failed to extract JSON from response: ${e}`);
          }
        }
      }
      
      // If all parsing attempts fail, return empty array
      error("Failed to parse statements from model response");
      return [];
    } catch (e) {
      error(`Error getting statements: ${e}`);
      return [];
    }
  }

  /**
   * Get verdicts for statements against actual output asynchronously
   */
  private async _aGetVerdicts(actualOutput: string | string[]): Promise<ACVerdict[]> {
    log("Getting verdicts asynchronously");
    
    if (!this.statements || this.statements.length === 0) {
      warn("No statements to evaluate");
      return [];
    }

    // Handle string array
    const actualOutputStr = Array.isArray(actualOutput) ? actualOutput.join('\n') : actualOutput;

    const prompt = AnswerCorrectnessTemplate.generateVerdicts(
      this.statements,
      actualOutputStr
    );
    
    try {
      const response = await this.model.aGenerate(prompt);
      
      // Parse the response
      try {
        const jsonResponse = JSON.parse(response);
        const parsed = VerdictsSchema.safeParse(jsonResponse);
        
        if (parsed.success) {
          return parsed.data.verdicts;
        } else {
          // Fallback to direct access if schema validation fails
          warn("Schema validation failed, falling back to raw response parsing");
          if (jsonResponse.verdicts && Array.isArray(jsonResponse.verdicts)) {
            return jsonResponse.verdicts.map((v: any) => ({
              verdict: v.verdict,
              reason: v.reason
            }));
          }
        }
      } catch (parseError) {
        warn(`Error parsing JSON response: ${parseError}`);
        // Try to extract JSON from the response text
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const extractedJson = JSON.parse(jsonMatch[0]);
            if (extractedJson.verdicts && Array.isArray(extractedJson.verdicts)) {
              return extractedJson.verdicts.map((v: any) => ({
                verdict: v.verdict,
                reason: v.reason
              }));
            }
          } catch (e) {
            error(`Failed to extract JSON from response: ${e}`);
          }
        }
      }
      
      // If all parsing attempts fail, return empty array
      error("Failed to parse verdicts from model response");
      return [];
    } catch (e) {
      error(`Error getting verdicts: ${e}`);
      return [];
    }
  }

  /**
   * Get verdicts for statements against actual output synchronously
   */
  private _getVerdicts(actualOutput: string | string[]): ACVerdict[] {
    if (!this.statements || this.statements.length === 0) {
      warn("No statements to evaluate");
      return [];
    }

    // Handle string array
    const actualOutputStr = Array.isArray(actualOutput) ? actualOutput.join('\n') : actualOutput;

    const prompt = AnswerCorrectnessTemplate.generateVerdicts(
      this.statements,
      actualOutputStr
    );
    
    try {
      const response = this.model.generate(prompt);
      
      // Parse the response
      try {
        const jsonResponse = JSON.parse(response);
        const parsed = VerdictsSchema.safeParse(jsonResponse);
        
        if (parsed.success) {
          return parsed.data.verdicts;
        } else {
          // Fallback to direct access if schema validation fails
          warn("Schema validation failed, falling back to raw response parsing");
          if (jsonResponse.verdicts && Array.isArray(jsonResponse.verdicts)) {
            return jsonResponse.verdicts.map((v: any) => ({
              verdict: v.verdict,
              reason: v.reason
            }));
          }
        }
      } catch (parseError) {
        warn(`Error parsing JSON response: ${parseError}`);
        // Try to extract JSON from the response text
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const extractedJson = JSON.parse(jsonMatch[0]);
            if (extractedJson.verdicts && Array.isArray(extractedJson.verdicts)) {
              return extractedJson.verdicts.map((v: any) => ({
                verdict: v.verdict,
                reason: v.reason
              }));
            }
          } catch (e) {
            error(`Failed to extract JSON from response: ${e}`);
          }
        }
      }
      
      // If all parsing attempts fail, return empty array
      error("Failed to parse verdicts from model response");
      return [];
    } catch (e) {
      error(`Error getting verdicts: ${e}`);
      return [];
    }
  }

  /**
   * Get reason for the score asynchronously
   */
  private async _aGetReason(): Promise<string | undefined> {
    if (!this.include_reason) {
      return undefined;
    }
    
    if (!this.verdicts || this.verdicts.length === 0) {
      return undefined;
    }
    
    try {
      // Get incorrect statements with their verdicts
      const incorrectStatements: [string, string][] = [];
      for (let i = 0; i < this.statements!.length; i++) {
        if (i < this.verdicts.length && this.verdicts[i].verdict.toLowerCase() === "no") {
          incorrectStatements.push([this.statements![i], this.verdicts[i].reason]);
        }
      }
      
      if (incorrectStatements.length === 0) {
        return "All statements in the expected output are correctly represented in the actual output.";
      }
      
      // Generate reason
      const prompt = AnswerCorrectnessTemplate.generateReason(
        incorrectStatements,
        this.score?.toString() || "0"
      );
      
      const reasonText = await this.model.aGenerate(prompt);
      const parsedReason = ReasonSchema.safeParse(JSON.parse(reasonText));
      
      if (!parsedReason.success) {
        error(`Failed to parse reason: ${parsedReason.error}`);
        return undefined;
      }
      
      return parsedReason.data.reason;
    } catch (err) {
      error(`Error getting reason: ${err}`);
      return undefined;
    }
  }

  /**
   * Get reason for the score synchronously
   */
  private _getReason(): string | undefined {
    if (!this.include_reason) {
      return undefined;
    }
    
    if (!this.verdicts || this.verdicts.length === 0) {
      return undefined;
    }
    
    try {
      // Get incorrect statements with their verdicts
      const incorrectStatements: [string, string][] = [];
      for (let i = 0; i < this.statements!.length; i++) {
        if (i < this.verdicts.length && this.verdicts[i].verdict.toLowerCase() === "no") {
          incorrectStatements.push([this.statements![i], this.verdicts[i].reason]);
        }
      }
      
      if (incorrectStatements.length === 0) {
        return "All statements in the expected output are correctly represented in the actual output.";
      }
      
      // Generate reason
      const prompt = AnswerCorrectnessTemplate.generateReason(
        incorrectStatements,
        this.score?.toString() || "0"
      );
      
      const reasonText = this.model.generate(prompt);
      const parsedReason = ReasonSchema.safeParse(JSON.parse(reasonText));
      
      if (!parsedReason.success) {
        error(`Failed to parse reason: ${parsedReason.error}`);
        return undefined;
      }
      
      return parsedReason.data.reason;
    } catch (err) {
      error(`Error getting reason: ${err}`);
      return undefined;
    }
  }

  /**
   * Compute score based on verdicts
   */
  private _computeScore(): number {
    log("Computing score");
    
    // If we have no statements or verdicts due to API errors, return 0 instead of 1
    // This ensures that when API calls fail, we don't incorrectly return a perfect score
    if (!this.statements || this.statements.length === 0) {
      return 0;
    }
    
    if (!this.verdicts || this.verdicts.length === 0) {
      return 0;
    }
    
    let correctCount = 0;
    for (const verdict of this.verdicts) {
      if (verdict.verdict.trim().toLowerCase() === "yes") {
        correctCount++;
      }
    }
    
    const score = correctCount / this.verdicts.length;
    
    // Match Python implementation's handling of strict_mode
    return this.strict_mode && score < this.threshold ? 0 : score;
  }

  /**
   * Check if example has required parameters
   */
  private _checkExampleParams(example: Example): void {
    for (const param of requiredParams) {
      if (param === 'input' && !example.input) {
        throw new Error(`Example is missing required parameter: input`);
      } else if (param === 'actualOutput' && !example.actualOutput) {
        throw new Error(`Example is missing required parameter: actualOutput`);
      } else if (param === 'expectedOutput' && !example.expectedOutput) {
        throw new Error(`Example is missing required parameter: expectedOutput`);
      }
    }
  }

  /**
   * Create verbose logs for debugging
   */
  private _createVerboseLogs(): string {
    if (!this.verbose_mode) {
      return '';
    }
    
    const steps = [
      `Statements:\n${JSON.stringify(this.statements, null, 2)}`,
      `Verdicts:\n${JSON.stringify(this.verdicts, null, 2)}`,
      `Score: ${this.score}\nReason: ${this.reason}`
    ];
    
    return steps.join('\n\n');
  }

  /**
   * Score an example synchronously - this is for compatibility with the Python SDK
   */
  syncScoreExample(example: Example): ScorerData {
    info("Starting example scoring (sync mode)");
    
    try {
      // Check required parameters
      this._checkExampleParams(example);
      
      // Process example
      if (this.async_mode) {
        throw new Error("Cannot use synchronous scoreExample with async_mode=true. Use async scoreExample instead.");
      }
      
      // Track token usage
      let promptTokens = 0;
      let completionTokens = 0;
      
      // Get statements and track tokens
      this.statements = this._getStatements(example.expectedOutput!);
      promptTokens += 500; // Approximate tokens for statements prompt
      completionTokens += 100; // Approximate tokens for statements response
      
      // Get verdicts and track tokens
      this.verdicts = this._getVerdicts(example.actualOutput!);
      promptTokens += 800; // Approximate tokens for verdicts prompt
      completionTokens += 200; // Approximate tokens for verdicts response
      
      // Compute score
      this.score = this._computeScore();
      
      // Get reason if needed
      if (this.include_reason) {
        this.reason = this._getReason();
        promptTokens += 300; // Approximate tokens for reason prompt
        completionTokens += 100; // Approximate tokens for reason response
      }
      
      // Calculate evaluation cost
      this.evaluation_cost = this._calculateTokenCosts(
        this.evaluation_model || 'gpt-3.5-turbo',
        promptTokens,
        completionTokens
      );
      
      // Set success flag
      this.success = this.score >= this.threshold;
      
      // Create verbose logs if needed
      if (this.verbose_mode) {
        this.verbose_logs = this._createVerboseLogs();
      }
      
      info(`Scoring completed with score: ${this.score}`);
      
      // Ensure all fields match the ScorerData interface
      return {
        name: this.type,
        threshold: this.threshold,
        success: this.success || false,
        score: this.score || 0,
        reason: this.reason !== undefined ? this.reason : null,
        strict_mode: this.strict_mode || false,
        evaluation_model: this.evaluation_model || null,
        error: null,
        evaluation_cost: this.evaluation_cost,
        verbose_logs: this.verbose_logs ? this.verbose_logs : null,
        additional_metadata: this.additional_metadata || {}
      };
    } catch (error: any) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.error = errorMessage;
      this.success = false;
      
      return {
        name: this.type,
        threshold: this.threshold,
        success: false,
        score: 0,
        reason: `Error during scoring: ${errorMessage}`,
        strict_mode: this.strict_mode || false,
        evaluation_model: this.evaluation_model || null,
        error: errorMessage,
        evaluation_cost: null,
        verbose_logs: null,
        additional_metadata: this.additional_metadata || {}
      };
    }
  }

  /**
   * Score an example - this is the main method that should be called
   * It will use async or sync methods based on the async_mode setting
   */
  async scoreExample(example: Example): Promise<ScorerData> {
    if (!this.async_mode) {
      return this.syncScoreExample(example);
    }
    
    info("Starting example scoring (async mode)");
    
    try {
      // Check required parameters
      this._checkExampleParams(example);
      
      // Track token usage
      let promptTokens = 0;
      let completionTokens = 0;
      
      // Process example
      this.statements = await this._aGetStatements(example.expectedOutput!);
      promptTokens += 500; // Approximate tokens for statements prompt
      completionTokens += 100; // Approximate tokens for statements response
      
      this.verdicts = await this._aGetVerdicts(example.actualOutput!);
      promptTokens += 800; // Approximate tokens for verdicts prompt
      completionTokens += 200; // Approximate tokens for verdicts response
      
      this.score = this._computeScore();
      
      if (this.include_reason) {
        this.reason = await this._aGetReason();
        promptTokens += 300; // Approximate tokens for reason prompt
        completionTokens += 100; // Approximate tokens for reason response
      }
      
      this.success = this._successCheck();
      
      if (this.verbose_mode) {
        this.verbose_logs = this._createVerboseLogs();
      }
      
      // Calculate evaluation cost
      this.evaluation_cost = this._calculateTokenCosts(
        this.evaluation_model || 'gpt-3.5-turbo',
        promptTokens,
        completionTokens
      );
      
      info(`Scoring completed with score: ${this.score}`);
      
      // Ensure all fields match the ScorerData interface
      return {
        name: this.type,
        threshold: this.threshold,
        success: this.success || false,
        score: this.score || 0,
        reason: this.reason !== undefined ? this.reason : null,
        strict_mode: this.strict_mode || false,
        evaluation_model: this.evaluation_model || null,
        error: null,
        evaluation_cost: this.evaluation_cost,
        verbose_logs: this.verbose_logs ? this.verbose_logs : null,
        additional_metadata: this.additional_metadata || {}
      };
    } catch (error: any) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.error = errorMessage;
      this.success = false;
      
      return {
        name: this.type,
        threshold: this.threshold,
        success: false,
        score: 0,
        reason: `Error during scoring: ${errorMessage}`,
        strict_mode: this.strict_mode || false,
        evaluation_model: this.evaluation_model || null,
        error: errorMessage,
        evaluation_cost: null,
        verbose_logs: null,
        additional_metadata: this.additional_metadata || {}
      };
    }
  }

  /**
   * Get the name of the scorer
   */
  get name(): string {
    return "Answer Correctness";
  }
}
