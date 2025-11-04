import { JUDGMENT_API_KEY, JUDGMENT_ORG_ID } from "../../../env";
import { RemoteScorer } from "../../remote-scorer";
import { pushPromptScorer } from "./prompt-scorer-utils";

export abstract class BasePromptScorer extends RemoteScorer {
  public prompt: string;
  public model: string | null;
  public options?: Record<string, number> | null;
  public description?: string | null;
  public judgmentApiKey: string;
  public organizationId: string;

  constructor(
    scoreType: string,
    name: string,
    prompt: string,
    threshold: number,
    model: string | null,
    options?: Record<string, number> | null,
    description?: string | null,
    judgmentApiKey: string = JUDGMENT_API_KEY ?? "",
    organizationId: string = JUDGMENT_ORG_ID ?? "",
  ) {
    super({
      scoreType,
      name,
      threshold,
      model,
      requiredParams: [],
      kwargs: {
        prompt,
        ...(options ? { options } : {}),
        ...(description ? { description } : {}),
      },
    });
    this.prompt = prompt;
    this.model = model;
    this.options = options;
    this.description = description;
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

  async setModel(model: string | null): Promise<void> {
    this.model = model;
    await this.pushPromptScorer();
  }

  async setDescription(description: string | null): Promise<void> {
    this.description = description;
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

  getModel(): string | null {
    return this.model;
  }

  getDescription(): string | null | undefined {
    return this.description;
  }

  getName(): string {
    return this.name;
  }

  getConfig(): Record<string, unknown> {
    return {
      name: this.name,
      prompt: this.prompt,
      threshold: this.threshold,
      model: this.model,
      options: this.options,
      description: this.description,
    };
  }

  protected async pushPromptScorer(): Promise<void> {
    await pushPromptScorer(
      this.name,
      this.prompt,
      this.threshold,
      this.model,
      this.options,
      this.description,
      this.judgmentApiKey,
      this.organizationId,
      this.getIsTrace(),
    );
  }

  toString(): string {
    return `${this.constructor.name}(name=${this.name}, prompt=${
      this.prompt
    }, threshold=${this.threshold}, model=${this.model}, options=${JSON.stringify(this.options)}, description=${this.description})`;
  }
}
