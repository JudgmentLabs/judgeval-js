import { Example } from '../../../data/example.js';
import { ScorerData } from '../../../data/result.js';
import { JudgevalScorer } from '../../base-scorer.js';
import { APIScorer } from '../../../constants.js';
import { log, info, warn, error } from '../../../common/logger.js';
import { 
  HallucinationTemplate, 
  HallucinationVerdict,
  VerdictsSchema,
  ReasonSchema
} from './prompts.js';
import { Judge, createJudge } from '../../../judges/index.js';

// Required parameters for this scorer
const required_params = ['actualOutput', 'context'];

/**
 * HallucinationScorer evaluates whether an LLM's output contains hallucinations
 * by comparing it against provided context.
 * 
 * The score is the fraction of context segments that contradict the output.
 * Lower scores are better (0 = no hallucinations, 1 = all contexts contradict the output).
 */
export class HallucinationScorer extends JudgevalScorer {
  private model: Judge;
  private using_native_model: boolean;
  private _verdicts: HallucinationVerdict[] = [];
  
  /**
   * Create a new HallucinationScorer
   * 
   * @param threshold - Success threshold (default: 0.5)
   * @param model - Model to use for evaluation (default: DefaultJudge)
   * @param include_reason - Whether to include a reason for the score (default: true)
   * @param async_mode - Whether to use async mode (default: false)
   * @param strict_mode - Whether to use strict mode (default: false)
   * @param verbose_mode - Whether to include verbose logs (default: false)
   */
  constructor(
    threshold: number = 0.5,
    model: string | Judge | undefined = undefined,
    include_reason: boolean = true,
    async_mode: boolean = false,
    strict_mode: boolean = false,
    verbose_mode: boolean = false
  ) {
    super(
      APIScorer.HALLUCINATION,
      strict_mode ? 1 : threshold,
      undefined,
      include_reason,
      async_mode,
      strict_mode,
      verbose_mode
    );

    const { judge, usingNativeModel } = createJudge(model);
    this.model = judge;
    this.using_native_model = usingNativeModel;
    this.evaluation_model = this.model.getModelName();
  }

  /**
   * Generate verdicts for each context
   */
  private async _aGenerateVerdicts(actualOutput: string, contexts: string[]): Promise<HallucinationVerdict[]> {
    const prompt = HallucinationTemplate.generateVerdicts(actualOutput, contexts);
    
    if (this.using_native_model) {
      const res = await this.model.aGenerate(prompt);
      try {
        const data = JSON.parse(res);
        return data.verdicts.map((item: any) => ({
          verdict: item.verdict,
          reason: item.reason
        }));
      } catch (error) {
        throw new Error(`Failed to parse response: ${error}`);
      }
    } else {
      try {
        const parseVerdictsResponse = (response: string): { verdicts: HallucinationVerdict[] } => {
          const parsed = JSON.parse(response);
          const result = VerdictsSchema.safeParse(parsed);
          if (result.success) {
            return result.data;
          }
          throw new Error(`Invalid response format: ${result.error}`);
        };
        
        const res = await this.model.aGenerate(prompt);
        return parseVerdictsResponse(res).verdicts;
      } catch (error) {
        const res = await this.model.aGenerate(prompt);
        try {
          const data = JSON.parse(res);
          return data.verdicts.map((item: any) => ({
            verdict: item.verdict,
            reason: item.reason
          }));
        } catch (parseError) {
          throw new Error(`Failed to parse response: ${parseError}`);
        }
      }
    }
  }

  /**
   * Generate verdicts for each context (synchronous)
   */
  private _generateVerdicts(actualOutput: string, contexts: string[]): HallucinationVerdict[] {
    const prompt = HallucinationTemplate.generateVerdicts(actualOutput, contexts);
    
    if (this.using_native_model) {
      const res = this.model.generate(prompt);
      try {
        const data = JSON.parse(res);
        return data.verdicts.map((item: any) => ({
          verdict: item.verdict,
          reason: item.reason
        }));
      } catch (error) {
        throw new Error(`Failed to parse response: ${error}`);
      }
    } else {
      try {
        const parseVerdictsResponse = (response: string): { verdicts: HallucinationVerdict[] } => {
          const parsed = JSON.parse(response);
          const result = VerdictsSchema.safeParse(parsed);
          if (result.success) {
            return result.data;
          }
          throw new Error(`Invalid response format: ${result.error}`);
        };
        
        const res = this.model.generate(prompt);
        return parseVerdictsResponse(res).verdicts;
      } catch (error) {
        const res = this.model.generate(prompt);
        try {
          const data = JSON.parse(res);
          return data.verdicts.map((item: any) => ({
            verdict: item.verdict,
            reason: item.reason
          }));
        } catch (parseError) {
          throw new Error(`Failed to parse response: ${parseError}`);
        }
      }
    }
  }

  /**
   * Generate a reason for the score
   */
  private async _aGenerateReason(actualOutput: string, contexts: string[]): Promise<string> {
    if (!this.include_reason) {
      return "No reason provided (include_reason is false)";
    }

    const prompt = HallucinationTemplate.generateReason(actualOutput, contexts);
    
    if (this.using_native_model) {
      const res = await this.model.aGenerate(prompt);
      try {
        const data = JSON.parse(res);
        return data.reason || "No reason provided in response";
      } catch (error) {
        throw new Error(`Failed to parse response: ${error}`);
      }
    } else {
      try {
        const parseReasonResponse = (response: string): { reason: string } => {
          const parsed = JSON.parse(response);
          const result = ReasonSchema.safeParse(parsed);
          if (result.success) {
            return result.data;
          }
          throw new Error(`Invalid response format: ${result.error}`);
        };
        
        const res = await this.model.aGenerate(prompt);
        return parseReasonResponse(res).reason;
      } catch (error) {
        const res = await this.model.aGenerate(prompt);
        try {
          const data = JSON.parse(res);
          return data.reason || "No reason provided in response";
        } catch (parseError) {
          throw new Error(`Failed to parse response: ${parseError}`);
        }
      }
    }
  }

  /**
   * Generate a reason for the score (synchronous)
   */
  private _generateReason(actualOutput: string, contexts: string[]): string {
    if (!this.include_reason) {
      return "No reason provided (include_reason is false)";
    }

    const prompt = HallucinationTemplate.generateReason(actualOutput, contexts);
    
    if (this.using_native_model) {
      const res = this.model.generate(prompt);
      try {
        const data = JSON.parse(res);
        return data.reason || "No reason provided in response";
      } catch (error) {
        throw new Error(`Failed to parse response: ${error}`);
      }
    } else {
      try {
        const parseReasonResponse = (response: string): { reason: string } => {
          const parsed = JSON.parse(response);
          const result = ReasonSchema.safeParse(parsed);
          if (result.success) {
            return result.data;
          }
          throw new Error(`Invalid response format: ${result.error}`);
        };
        
        const res = this.model.generate(prompt);
        return parseReasonResponse(res).reason;
      } catch (error) {
        const res = this.model.generate(prompt);
        try {
          const data = JSON.parse(res);
          return data.reason || "No reason provided in response";
        } catch (parseError) {
          throw new Error(`Failed to parse response: ${parseError}`);
        }
      }
    }
  }

  /**
   * Calculate the hallucination score
   */
  private _computeScore(): number {
    if (this._verdicts.length === 0) {
      return 0;
    }

    let contradictions = 0;
    for (const verdict of this._verdicts) {
      if (verdict.verdict.trim().toLowerCase() === "no") {
        contradictions += 1;
      }
    }

    return contradictions / this._verdicts.length;
  }

  /**
   * Create verbose logs for debugging
   */
  private _createVerboseLogs(): string | null {
    if (!this.verbose_mode) {
      return null;
    }
    
    const steps = [
      `Verdicts:\n${JSON.stringify(this._verdicts, null, 2)}`,
      `Score: ${this.score}\nReason: ${this.reason || "No reason provided"}`
    ];
    
    return steps.join('\n\n');
  }

  /**
   * Check if example has required parameters
   */
  private _checkExampleParams(example: Example): void {
    for (const param of required_params) {
      if (param === 'actualOutput' && !example.actualOutput) {
        throw new Error(`Example is missing required parameter: actualOutput`);
      } else if (param === 'context' && !example.context) {
        throw new Error(`Example is missing required parameter: context`);
      }
    }
  }

  /**
   * Score an example synchronously
   */
  syncScoreExample(example: Example): ScorerData {
    info("Starting example scoring (sync mode)");
    
    try {
      // Check required parameters
      this._checkExampleParams(example);
      
      // Process example
      const contexts = Array.isArray(example.context) ? example.context : [example.context || ''];
      this._verdicts = this._generateVerdicts(example.actualOutput as string, contexts);
      
      // Calculate score
      this.score = this._computeScore();
      this.reason = this._generateReason(example.actualOutput as string, contexts) || '';
      this.success = this._successCheck();
      
      // Create verbose logs if enabled
      const verbose_logs = this._createVerboseLogs();
      
      // Calculate evaluation cost
      const promptTokens = 600; // Estimate - in a real implementation, track actual tokens
      const completionTokens = 200; // Estimate - in a real implementation, track actual tokens
      this.evaluation_cost = this._calculateTokenCosts(
        this.evaluation_model || 'gpt-3.5-turbo',
        promptTokens,
        completionTokens
      );
      
      info(`Scoring completed with score: ${this.score}`);
      
      // Return ScorerData object
      return {
        name: this.type,
        threshold: this.threshold,
        success: this.success,
        score: this.score,
        reason: this.reason,
        strict_mode: this.strict_mode,
        evaluation_model: this.evaluation_model || null,
        error: null,
        evaluation_cost: this.evaluation_cost || null,
        verbose_logs: verbose_logs,
        additional_metadata: {
          verdicts: this._verdicts
        }
      };
    } catch (error: any) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.error = errorMessage;
      
      return {
        name: this.type,
        threshold: this.threshold,
        success: false,
        score: 0,
        reason: `Error during scoring: ${errorMessage}`,
        strict_mode: this.strict_mode,
        evaluation_model: this.evaluation_model || null,
        error: errorMessage,
        evaluation_cost: null,
        verbose_logs: null,
        additional_metadata: {}
      };
    }
  }

  /**
   * Score an example asynchronously
   */
  async scoreExample(example: Example): Promise<ScorerData> {
    if (!this.async_mode) {
      return this.syncScoreExample(example);
    }
    
    info("Starting example scoring (async mode)");
    
    try {
      // Check required parameters
      this._checkExampleParams(example);
      
      // Process example
      const contexts = Array.isArray(example.context) ? example.context : [example.context || ''];
      this._verdicts = await this._aGenerateVerdicts(example.actualOutput as string, contexts);
      
      // Calculate score
      this.score = this._computeScore();
      this.reason = await this._aGenerateReason(example.actualOutput as string, contexts) || '';
      this.success = this._successCheck();
      
      // Create verbose logs if enabled
      const verbose_logs = this._createVerboseLogs();
      
      // Calculate evaluation cost
      const promptTokens = 600; // Estimate - in a real implementation, track actual tokens
      const completionTokens = 200; // Estimate - in a real implementation, track actual tokens
      this.evaluation_cost = this._calculateTokenCosts(
        this.evaluation_model || 'gpt-3.5-turbo',
        promptTokens,
        completionTokens
      );
      
      info(`Scoring completed with score: ${this.score}`);
      
      // Return ScorerData object
      return {
        name: this.type,
        threshold: this.threshold,
        success: this.success,
        score: this.score,
        reason: this.reason,
        strict_mode: this.strict_mode,
        evaluation_model: this.evaluation_model || null,
        error: null,
        evaluation_cost: this.evaluation_cost || null,
        verbose_logs: verbose_logs,
        additional_metadata: {
          verdicts: this._verdicts
        }
      };
    } catch (error: any) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.error = errorMessage;
      
      return {
        name: this.type,
        threshold: this.threshold,
        success: false,
        score: 0,
        reason: `Error during scoring: ${errorMessage}`,
        strict_mode: this.strict_mode,
        evaluation_model: this.evaluation_model || null,
        error: errorMessage,
        evaluation_cost: null,
        verbose_logs: null,
        additional_metadata: {}
      };
    }
  }

  /**
   * Get the name of the scorer
   */
  get name(): string {
    return "Hallucination";
  }
}
