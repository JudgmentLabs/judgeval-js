import { Example } from '../../../data/example.js';
import { ScorerData } from '../../../data/result.js';
import { JudgevalScorer } from '../../base-scorer.js';
import { APIScorer } from '../../../constants.js';
import { log, info, warn, error } from '../../../common/logger.js';
import { 
  FaithfulnessTemplate, 
  FaithfulnessVerdict, 
  ClaimsSchema, 
  VerdictsSchema, 
  ReasonSchema 
} from './prompts.js';
import { Judge, createJudge } from '../../../judges/index.js';

// Required parameters for this scorer
const requiredParams = ['input', 'actualOutput', 'retrievalContext'];

/**
 * FaithfulnessScorer evaluates how well the actual output is supported by the retrieval context
 * by extracting claims from the output and checking if each claim is supported by the context.
 */
export class FaithfulnessScorer extends JudgevalScorer {
  private model: Judge;
  private usingNativeModel: boolean;
  private claims?: string[];
  private claimsWithQuotes?: Array<{claim: string, quote: string}>;
  private verdicts?: FaithfulnessVerdict[];
  evaluation_cost?: number;
  reason?: string;

  /**
   * Constructor for FaithfulnessScorer
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
      APIScorer.FAITHFULNESS,
      strict_mode ? 1.0 : threshold,
      additional_metadata,
      include_reason,
      async_mode,
      strict_mode,
      verbose_mode
    );
    
    info(`Initializing FaithfulnessScorer with threshold=${this.threshold}, model=${model}, strict_mode=${strict_mode}`);
    
    const { judge, usingNativeModel } = createJudge(model, user);
    this.model = judge;
    this.usingNativeModel = usingNativeModel;
    this.evaluation_model = this.model.getModelName();
    
    log(`Using model: ${this.evaluation_model}`);
  }

  /**
   * Generate claims from actual output asynchronously
   */
  private async _aGenerateClaims(actualOutput: string | string[], allClaims: boolean = false): Promise<string[]> {
    log("Generating claims asynchronously");
    
    // Handle string array
    const actualOutputStr = Array.isArray(actualOutput) ? actualOutput.join('\n') : actualOutput;
    
    const prompt = FaithfulnessTemplate.findClaims(actualOutputStr, allClaims);
    
    try {
      const response = await this.model.aGenerate(prompt);
      
      // Parse the response
      try {
        const jsonResponse = JSON.parse(response);
        const parsed = ClaimsSchema.safeParse(jsonResponse);
        
        if (parsed.success) {
          this.claimsWithQuotes = parsed.data.claims;
          return parsed.data.claims.map(c => c.claim);
        } else {
          // Fallback to direct access if schema validation fails
          warn("Schema validation failed, falling back to raw response parsing");
          if (jsonResponse.claims && Array.isArray(jsonResponse.claims)) {
            this.claimsWithQuotes = jsonResponse.claims;
            return jsonResponse.claims.map((c: any) => c.claim);
          }
        }
      } catch (parseError) {
        warn(`Error parsing JSON response: ${parseError}`);
        // Try to extract JSON from the response text
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const extractedJson = JSON.parse(jsonMatch[0]);
            if (extractedJson.claims && Array.isArray(extractedJson.claims)) {
              this.claimsWithQuotes = extractedJson.claims;
              return extractedJson.claims.map((c: any) => c.claim);
            }
          } catch (e) {
            error(`Failed to extract JSON from response: ${e}`);
          }
        }
      }
      
      // If all parsing attempts fail, return empty array
      error("Failed to parse claims from model response");
      return [];
    } catch (e) {
      error(`Error generating claims: ${e}`);
      return [];
    }
  }

  /**
   * Generate claims from actual output synchronously
   */
  private _generateClaims(actualOutput: string | string[], allClaims: boolean = false): string[] {
    // Handle string array
    const actualOutputStr = Array.isArray(actualOutput) ? actualOutput.join('\n') : actualOutput;
    
    const prompt = FaithfulnessTemplate.findClaims(actualOutputStr, allClaims);
    
    try {
      const response = this.model.generate(prompt);
      
      // Parse the response
      try {
        const jsonResponse = JSON.parse(response);
        const parsed = ClaimsSchema.safeParse(jsonResponse);
        
        if (parsed.success) {
          this.claimsWithQuotes = parsed.data.claims;
          return parsed.data.claims.map(c => c.claim);
        } else {
          // Fallback to direct access if schema validation fails
          warn("Schema validation failed, falling back to raw response parsing");
          if (jsonResponse.claims && Array.isArray(jsonResponse.claims)) {
            this.claimsWithQuotes = jsonResponse.claims;
            return jsonResponse.claims.map((c: any) => c.claim);
          }
        }
      } catch (parseError) {
        warn(`Error parsing JSON response: ${parseError}`);
        // Try to extract JSON from the response text
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const extractedJson = JSON.parse(jsonMatch[0]);
            if (extractedJson.claims && Array.isArray(extractedJson.claims)) {
              this.claimsWithQuotes = extractedJson.claims;
              return extractedJson.claims.map((c: any) => c.claim);
            }
          } catch (e) {
            error(`Failed to extract JSON from response: ${e}`);
          }
        }
      }
      
      // If all parsing attempts fail, return empty array
      error("Failed to parse claims from model response");
      return [];
    } catch (e) {
      error(`Error generating claims: ${e}`);
      return [];
    }
  }

  /**
   * Generate verdicts for claims against retrieval context asynchronously
   */
  private async _aGenerateVerdicts(retrievalContext: string | string[]): Promise<FaithfulnessVerdict[]> {
    log("Generating verdicts asynchronously");
    
    if (!this.claims || this.claims.length === 0) {
      warn("No claims to evaluate");
      return [];
    }

    // Handle string array
    const contextStr = Array.isArray(retrievalContext) ? retrievalContext.join('\n') : retrievalContext;

    const prompt = FaithfulnessTemplate.generateVerdicts(
      this.claims,
      contextStr
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
      error(`Error generating verdicts: ${e}`);
      return [];
    }
  }

  /**
   * Generate verdicts for claims against retrieval context synchronously
   */
  private _generateVerdicts(retrievalContext: string | string[]): FaithfulnessVerdict[] {
    if (!this.claims || this.claims.length === 0) {
      warn("No claims to evaluate");
      return [];
    }

    // Handle string array
    const contextStr = Array.isArray(retrievalContext) ? retrievalContext.join('\n') : retrievalContext;

    const prompt = FaithfulnessTemplate.generateVerdicts(
      this.claims,
      contextStr
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
      error(`Error generating verdicts: ${e}`);
      return [];
    }
  }

  /**
   * Generate reason for the score asynchronously
   */
  private async _aGenerateReason(): Promise<string | undefined> {
    if (!this.include_reason) {
      return undefined;
    }
    
    if (!this.verdicts || this.verdicts.length === 0) {
      return undefined;
    }
    
    try {
      // Generate reason
      const prompt = FaithfulnessTemplate.generateReason(
        this.verdicts,
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
   * Generate reason for the score synchronously
   */
  private _generateReason(): string | undefined {
    if (!this.include_reason) {
      return undefined;
    }
    
    if (!this.verdicts || this.verdicts.length === 0) {
      return undefined;
    }
    
    try {
      // Generate reason
      const prompt = FaithfulnessTemplate.generateReason(
        this.verdicts,
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
    
    // If we have no claims or verdicts due to API errors, return 0
    if (!this.claims || this.claims.length === 0) {
      return 0;
    }
    
    if (!this.verdicts || this.verdicts.length === 0) {
      return 0;
    }
    
    let supportedCount = 0;
    let partialCount = 0;
    
    for (const verdict of this.verdicts) {
      const verdictLower = verdict.verdict.trim().toLowerCase();
      if (verdictLower === "yes") {
        supportedCount++;
      } else if (verdictLower === "partially") {
        partialCount += 0.5;
      }
    }
    
    const score = (supportedCount + partialCount) / this.verdicts.length;
    
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
      } else if (param === 'retrievalContext' && !example.retrievalContext) {
        throw new Error(`Example is missing required parameter: retrievalContext`);
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
      `Claims:\n${JSON.stringify(this.claims, null, 2)}`,
      `Verdicts:\n${JSON.stringify(this.verdicts, null, 2)}`,
      `Score: ${this.score}\nReason: ${this.reason}`
    ];
    
    return steps.join('\n\n');
  }

  /**
   * Score an example synchronously
   */
  syncScoreExample(example: Example, allClaims: boolean = false): ScorerData {
    info("Starting example scoring (sync mode)");
    
    try {
      // Check required parameters
      this._checkExampleParams(example);
      
      // Process example
      if (this.async_mode) {
        throw new Error("Cannot use synchronous scoreExample with async_mode=true. Use async scoreExample instead.");
      }
      
      this.claims = this._generateClaims(example.actualOutput!, allClaims);
      
      // Add claims to additional metadata
      if (!this.additional_metadata) {
        this.additional_metadata = {};
      }
      this.additional_metadata.claims = this.claims;
      this.additional_metadata.claimsWithQuotes = this.claimsWithQuotes;
      
      this.verdicts = this._generateVerdicts(example.retrievalContext!);
      this.additional_metadata.verdicts = this.verdicts;
      
      this.score = this._computeScore();
      this.reason = this._generateReason();
      this.success = this._successCheck();
      this.verbose_logs = this._createVerboseLogs();
      
      // Calculate evaluation cost
      // In a real implementation, you would track tokens used in each LLM call
      this.evaluation_cost = undefined;
      
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
        evaluation_cost: null,
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
   * Score an example asynchronously
   */
  async scoreExample(example: Example, allClaims: boolean = false): Promise<ScorerData> {
    if (!this.async_mode) {
      return this.syncScoreExample(example, allClaims);
    }
    
    info("Starting example scoring (async mode)");
    
    try {
      // Check required parameters
      this._checkExampleParams(example);
      
      // Process example
      this.claims = await this._aGenerateClaims(example.actualOutput!, allClaims);
      
      // Add claims to additional metadata
      if (!this.additional_metadata) {
        this.additional_metadata = {};
      }
      this.additional_metadata.claims = this.claims;
      this.additional_metadata.claimsWithQuotes = this.claimsWithQuotes;
      
      this.verdicts = await this._aGenerateVerdicts(example.retrievalContext!);
      this.additional_metadata.verdicts = this.verdicts;
      
      this.score = this._computeScore();
      this.reason = await this._aGenerateReason();
      this.success = this._successCheck();
      this.verbose_logs = this._createVerboseLogs();
      
      // Calculate evaluation cost
      // In a real implementation, you would track tokens used in each LLM call
      this.evaluation_cost = undefined;
      
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
        evaluation_cost: null,
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
    return "Faithfulness";
  }
}
