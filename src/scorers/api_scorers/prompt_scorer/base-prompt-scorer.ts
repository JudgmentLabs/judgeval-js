import { JUDGMENT_API_KEY, JUDGMENT_ORG_ID } from "../../../env";
import { RemoteScorer } from "../../remote-scorer";
import { pushPromptScorer } from "./prompt-scorer-utils";

export abstract class BasePromptScorer extends RemoteScorer {
  public prompt: string;
  public options?: Record<string, number> | null;
  public judgmentApiKey: string;
  public organizationId: string;

  constructor(
    scoreType: string,
    name: string,
    prompt: string,
    threshold: number,
    options?: Record<string, number> | null,
    judgmentApiKey: string = JUDGMENT_API_KEY ?? "",
    organizationId: string = JUDGMENT_ORG_ID ?? "",
  ) {
    super({
      scoreType,
      name,
      threshold,
      requiredParams: [],
      kwargs: {
        prompt,
        ...(options ? { options } : {}),
      },
    });
    this.prompt = prompt;
    this.options = options;
    this.judgmentApiKey = judgmentApiKey;
    this.organizationId = organizationId;
  }

  protected abstract getScoreType(): string;
  protected abstract getIsTrace(): boolean;

  async updateThreshold(threshold: number): Promise<void> {
    if (threshold < 0 || threshold > 1) {
      throw new Error(`Threshold must be between 0 and 1, got: ${threshold}`);
    }
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

  getConfig(): Record<string, unknown> {
    return {
      name: this.name,
      prompt: this.prompt,
      threshold: this.threshold,
      options: this.options,
    };
  }

  protected async pushPromptScorer(): Promise<void> {
    await pushPromptScorer(
      this.name,
      this.prompt,
      this.threshold,
      this.options,
      this.judgmentApiKey,
      this.organizationId,
      this.getIsTrace(),
    );
  }

  toString(): string {
    return `${this.constructor.name}(name=${this.name}, prompt=${
      this.prompt
    }, threshold=${this.threshold}, options=${JSON.stringify(this.options)})`;
  }
}
