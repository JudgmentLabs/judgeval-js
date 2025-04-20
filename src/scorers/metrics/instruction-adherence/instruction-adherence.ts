import { Example } from '../../../data/example.js';
import { ScorerData } from '../../../data/result.js';
import { JudgevalScorer } from '../../base-scorer.js';
import { APIScorer } from '../../../constants.js';
import { log, info, warn, error } from '../../../common/logger.js';
import { 
  InstructionAdherenceTemplate, 
  InstructionAdherenceVerdict,
  InstructionsSchema,
  VerdictsSchema
} from './prompts.js';
import { Judge, createJudge } from '../../../judges/index.js';

// Required parameters for this scorer
const required_params = ['input', 'actualOutput'];

/**
 * InstructionAdherenceScorer evaluates how well an LLM follows instructions
 * by extracting instructions from the input and checking if they are followed in the output.
 * 
 * The score is the average of scores for each instruction (1 = followed, 0.5 = partially followed, 0 = not followed).
 */
export class InstructionAdherenceScorer extends JudgevalScorer {
  private model: Judge;
  private using_native_model: boolean;
  private _instructions: string[] = [];
  private _verdicts: InstructionAdherenceVerdict[] = [];
  
  /**
   * Create a new InstructionAdherenceScorer
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
      APIScorer.INSTRUCTION_ADHERENCE,
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
   * Extract instructions from input text
   */
  private async _aGetInstructions(input: string): Promise<string[]> {
    const prompt = InstructionAdherenceTemplate.getInstructions(input);
    
    if (this.using_native_model) {
      const res = await this.model.aGenerate(prompt);
      try {
        const data = JSON.parse(res);
        return data.instructions || [];
      } catch (error) {
        throw new Error(`Failed to parse response: ${error}`);
      }
    } else {
      try {
        // Create a parser function to validate the response
        const parseInstructionsResponse = (response: string): { instructions: string[] } => {
          const parsed = JSON.parse(response);
          const result = InstructionsSchema.safeParse(parsed);
          if (result.success) {
            return result.data;
          }
          throw new Error(`Invalid response format: ${result.error}`);
        };
        
        const res = await this.model.aGenerate(prompt);
        return parseInstructionsResponse(res).instructions;
      } catch (error) {
        const res = await this.model.aGenerate(prompt);
        try {
          const data = JSON.parse(res);
          return data.instructions || [];
        } catch (parseError) {
          throw new Error(`Failed to parse response: ${parseError}`);
        }
      }
    }
  }

  /**
   * Extract instructions from input text (synchronous)
   */
  private _getInstructions(input: string): string[] {
    const prompt = InstructionAdherenceTemplate.getInstructions(input);
    
    if (this.using_native_model) {
      const res = this.model.generate(prompt);
      try {
        const data = JSON.parse(res);
        return data.instructions || [];
      } catch (error) {
        throw new Error(`Failed to parse response: ${error}`);
      }
    } else {
      try {
        // Create a parser function to validate the response
        const parseInstructionsResponse = (response: string): { instructions: string[] } => {
          const parsed = JSON.parse(response);
          const result = InstructionsSchema.safeParse(parsed);
          if (result.success) {
            return result.data;
          }
          throw new Error(`Invalid response format: ${result.error}`);
        };
        
        const res = this.model.generate(prompt);
        return parseInstructionsResponse(res).instructions;
      } catch (error) {
        const res = this.model.generate(prompt);
        try {
          const data = JSON.parse(res);
          return data.instructions || [];
        } catch (parseError) {
          throw new Error(`Failed to parse response: ${parseError}`);
        }
      }
    }
  }

  /**
   * Generate verdicts for each instruction
   */
  private async _aGetVerdicts(instructions: string[], actualOutput: string): Promise<InstructionAdherenceVerdict[]> {
    if (instructions.length === 0) {
      return [];
    }
    
    const prompt = InstructionAdherenceTemplate.generateVerdicts(instructions, actualOutput);
    
    if (this.using_native_model) {
      const res = await this.model.aGenerate(prompt);
      try {
        const data = JSON.parse(res);
        return data.verdicts || [];
      } catch (error) {
        throw new Error(`Failed to parse response: ${error}`);
      }
    } else {
      try {
        // Create a parser function to validate the response
        const parseVerdictsResponse = (response: string): { verdicts: InstructionAdherenceVerdict[] } => {
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
          return data.verdicts || [];
        } catch (parseError) {
          throw new Error(`Failed to parse response: ${parseError}`);
        }
      }
    }
  }

  /**
   * Generate verdicts for each instruction (synchronous)
   */
  private _getVerdicts(instructions: string[], actualOutput: string): InstructionAdherenceVerdict[] {
    if (instructions.length === 0) {
      return [];
    }
    
    const prompt = InstructionAdherenceTemplate.generateVerdicts(instructions, actualOutput);
    
    if (this.using_native_model) {
      const res = this.model.generate(prompt);
      try {
        const data = JSON.parse(res);
        return data.verdicts || [];
      } catch (error) {
        throw new Error(`Failed to parse response: ${error}`);
      }
    } else {
      try {
        // Create a parser function to validate the response
        const parseVerdictsResponse = (response: string): { verdicts: InstructionAdherenceVerdict[] } => {
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
          return data.verdicts || [];
        } catch (parseError) {
          throw new Error(`Failed to parse response: ${parseError}`);
        }
      }
    }
  }

  /**
   * Calculate the instruction adherence score
   */
  private _computeScore(): number {
    if (this._verdicts.length === 0) {
      return 1;
    }

    let totalScore = 0;
    for (const verdict of this._verdicts) {
      totalScore += verdict.score;
    }

    return totalScore / this._verdicts.length;
  }

  /**
   * Create verbose logs for debugging
   */
  private _createVerboseLogs(): string | null {
    if (!this.verbose_mode) {
      return null;
    }
    
    const steps = [
      `Instructions:\n${JSON.stringify(this._instructions, null, 2)}`,
      `Score: ${this.score}\nReason: ${this.reason || "No reason provided"}`
    ];
    
    return steps.join('\n\n');
  }

  /**
   * Check if example has required parameters
   */
  private _checkExampleParams(example: Example): void {
    for (const param of required_params) {
      if (param === 'input' && !example.input) {
        throw new Error(`Example is missing required parameter: input`);
      } else if (param === 'actualOutput' && !example.actualOutput) {
        throw new Error(`Example is missing required parameter: actualOutput`);
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
      this._instructions = this._getInstructions(example.input!);
      this._verdicts = this._getVerdicts(this._instructions, example.actualOutput as string);
      
      // Add instructions and verdicts to additional metadata
      const additional_metadata = {
        instructions: this._instructions,
        verdicts: this._verdicts
      };
      
      this.score = this._computeScore();
      this.reason = this._verdicts.length > 0 ? JSON.stringify(this._verdicts) : 'No instructions found';
      this.success = this._successCheck();
      const verbose_logs = this._createVerboseLogs();
      
      // Calculate evaluation cost
      const promptTokens = 700; // Estimate - in a real implementation, track actual tokens
      const completionTokens = 250; // Estimate - in a real implementation, track actual tokens
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
        success: this.success,
        score: this.score,
        reason: this.reason || "",
        strict_mode: this.strict_mode,
        evaluation_model: this.evaluation_model || null,
        error: null,
        evaluation_cost: this.evaluation_cost || null,
        verbose_logs: verbose_logs,
        additional_metadata: additional_metadata
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
      this._instructions = await this._aGetInstructions(example.input!);
      this._verdicts = await this._aGetVerdicts(this._instructions, example.actualOutput as string);
      
      // Add instructions and verdicts to additional metadata
      const additional_metadata = {
        instructions: this._instructions,
        verdicts: this._verdicts
      };
      
      this.score = this._computeScore();
      this.reason = this._verdicts.length > 0 ? JSON.stringify(this._verdicts) : 'No instructions found';
      this.success = this._successCheck();
      const verbose_logs = this._createVerboseLogs();
      
      // Calculate evaluation cost
      const promptTokens = 700; // Estimate - in a real implementation, track actual tokens
      const completionTokens = 250; // Estimate - in a real implementation, track actual tokens
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
        success: this.success,
        score: this.score,
        reason: this.reason || "",
        strict_mode: this.strict_mode,
        evaluation_model: this.evaluation_model || null,
        error: null,
        evaluation_cost: this.evaluation_cost || null,
        verbose_logs: verbose_logs,
        additional_metadata: additional_metadata
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
    return "Instruction Adherence";
  }
}
