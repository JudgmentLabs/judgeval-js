import { JUDGMENT_API_KEY, JUDGMENT_ORG_ID } from "../../../env";
import { ScorerConfig } from "../../../internal/api/models";
import { APIScorer, APIScorerType } from "../../api-scorer";
import {
  fetchPromptScorer,
  JudgmentAPIError,
  pushPromptScorer,
  scorerExists,
} from "./prompt-scorer-utils";

export abstract class BasePromptScorer
  implements APIScorer<APIScorerType, readonly string[]>
{
  public scoreType: APIScorerType;
  public name: string;
  public prompt: string;
  public threshold: number;
  public options?: Record<string, number> | null;
  public judgmentApiKey: string;
  public organizationId: string;
  public requiredParams: readonly string[];
  public score_type: string;
  public class_name: string;
  public model?: string;
  public score?: number;
  public error?: string | null;
  public strict_mode?: boolean;

  constructor(
    scoreType: APIScorerType,
    name: string,
    prompt: string,
    threshold: number,
    requiredParams: readonly string[],
    options?: Record<string, number> | null,
    judgmentApiKey: string = JUDGMENT_API_KEY || "",
    organizationId: string = JUDGMENT_ORG_ID || "",
  ) {
    this.scoreType = scoreType;
    this.name = name;
    this.prompt = prompt;
    this.threshold = threshold;
    this.requiredParams = requiredParams;
    this.options = options;
    this.judgmentApiKey = judgmentApiKey;
    this.organizationId = organizationId;
    this.score_type = scoreType;
    this.class_name = "BasePromptScorer";
    this.model = undefined;
    this.score = undefined;
    this.error = null;
    this.strict_mode = false;
  }
  score_breakdown?: Record<string, any> | null | undefined;
  reason?: string | null | undefined;
  using_native_model?: boolean | null | undefined;
  success?: boolean | null | undefined;
  model_client?: any;
  additional_metadata?: Record<string, any> | null | undefined;
  user?: string | null | undefined;
  server_hosted?: boolean | undefined;

  static async get<T extends BasePromptScorer>(
    this: new (...args: any[]) => T,
    name: string,
    judgmentApiKey: string = JUDGMENT_API_KEY || "",
    organizationId: string = JUDGMENT_ORG_ID || "",
  ): Promise<T> {
    const config = await fetchPromptScorer(
      name,
      judgmentApiKey,
      organizationId,
    );

    const isTrace = config.is_trace === true;
    const expectedIsTrace =
      this.prototype.scoreType === APIScorerType.TRACE_PROMPT_SCORER;

    if (isTrace !== expectedIsTrace) {
      throw new JudgmentAPIError(
        400,
        `Scorer with name ${name} is not a ${this.name}`,
      );
    }

    const scoreType = isTrace
      ? APIScorerType.TRACE_PROMPT_SCORER
      : APIScorerType.PROMPT_SCORER;

    return new this(
      scoreType,
      config.name, // Use config.name instead of name parameter
      config.prompt,
      config.threshold,
      [],
      config.options,
      judgmentApiKey,
      organizationId,
    );
  }

  static async create<T extends BasePromptScorer>(
    this: new (...args: any[]) => T,
    name: string,
    prompt: string,
    threshold: number = 0.5,
    options?: Record<string, number> | null,
    judgmentApiKey: string = JUDGMENT_API_KEY || "",
    organizationId: string = JUDGMENT_ORG_ID || "",
  ): Promise<T> {
    if (await scorerExists(name, judgmentApiKey, organizationId)) {
      throw new JudgmentAPIError(
        400,
        `Scorer with name ${name} already exists. Either use the existing scorer with the get() method or use a new name.`,
      );
    }

    const isTrace =
      this.prototype.scoreType === APIScorerType.TRACE_PROMPT_SCORER;
    const scoreType = isTrace
      ? APIScorerType.TRACE_PROMPT_SCORER
      : APIScorerType.PROMPT_SCORER;

    await pushPromptScorer(
      name,
      prompt,
      threshold,
      options,
      judgmentApiKey,
      organizationId,
      isTrace,
    );

    return new this(
      scoreType,
      name,
      prompt,
      threshold,
      [],
      options,
      judgmentApiKey,
      organizationId,
    );
  }

  async updateThreshold(threshold: number): Promise<void> {
    this.setThreshold(threshold);
    await this.pushPromptScorer();
  }

  async setPrompt(prompt: string): Promise<void> {
    this.prompt = prompt;
    await this.pushPromptScorer();
  }

  async setOptions(options: Record<string, number> | null): Promise<void> {
    this.options = options;
    await this.pushPromptScorer();
  }

  async appendToPrompt(promptAddition: string): Promise<void> {
    this.prompt += promptAddition;
    await this.pushPromptScorer();
  }

  getThreshold(): number {
    return this.threshold;
  }

  getPrompt(): string {
    return this.prompt;
  }

  getOptions(): Record<string, number> | null {
    return this.options ? { ...this.options } : null;
  }

  getName(): string {
    return this.name;
  }

  getConfig(): Record<string, any> {
    return {
      name: this.name,
      prompt: this.prompt,
      threshold: this.threshold,
      options: this.options,
    };
  }

  async pushPromptScorer(): Promise<void> {
    await pushPromptScorer(
      this.name,
      this.prompt,
      this.threshold,
      this.options,
      this.judgmentApiKey,
      this.organizationId,
    );
  }

  toString(): string {
    return `${this.constructor.name}(name=${this.name}, prompt=${
      this.prompt
    }, threshold=${this.threshold}, options=${JSON.stringify(this.options)})`;
  }

  addModel(model: string): void {
    this.model = model;
  }

  successCheck(): boolean {
    if (this.error != null) {
      return false;
    }
    if (this.score == null) {
      return false;
    }
    const threshold = this.threshold ?? 0.5;
    const score = this.score;
    return threshold != null && score != null && score >= threshold;
  }

  getRequiredParams(): string[] {
    if (Array.isArray(this.requiredParams)) {
      return [...this.requiredParams];
    }
    return [];
  }

  setThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error(`Threshold must be between 0 and 1, got: ${threshold}`);
    }
    this.threshold = threshold;
  }

  getScoreType(): APIScorerType {
    return this.scoreType;
  }

  setRequiredParams(params: readonly string[]): void {
    this.requiredParams = params;
  }

  toTransport(): ScorerConfig {
    return {
      score_type: this.getScoreType(),
      name: this.getName(),
      threshold: this.getThreshold(),
      strict_mode: this.strict_mode ?? false,
      required_params: this.getRequiredParams(),
      kwargs: {
        prompt: this.getPrompt(),
        ...(this.getOptions() ? { options: this.getOptions() } : {}),
      },
    };
  }
}
