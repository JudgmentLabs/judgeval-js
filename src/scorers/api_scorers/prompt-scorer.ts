import { JUDGMENT_API_KEY, JUDGMENT_API_URL, JUDGMENT_ORG_ID } from "../../env";
import { JudgmentApiClient } from "../../internal/api";
import { APIScorerType } from "../api-scorer";

export class JudgmentAPIError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "JudgmentAPIError";
  }
}

export async function pushPromptScorer(
  name: string,
  prompt: string,
  threshold: number,
  options?: Record<string, number> | null,
  judgmentApiKey: string = JUDGMENT_API_KEY || "",
  organizationId: string = JUDGMENT_ORG_ID || "",
  isTrace: boolean = false
): Promise<string> {
  if (!JUDGMENT_API_URL || !judgmentApiKey || !organizationId) {
    throw new Error("Missing required API credentials");
  }

  const client = new JudgmentApiClient(
    JUDGMENT_API_URL,
    judgmentApiKey,
    organizationId
  );
  const response = await client.saveScorer({
    name,
    prompt,
    threshold,
    options,
    is_trace: isTrace,
  });
  return response.name;
}

export async function fetchPromptScorer(
  name: string,
  judgmentApiKey: string = JUDGMENT_API_KEY || "",
  organizationId: string = JUDGMENT_ORG_ID || ""
) {
  if (!JUDGMENT_API_URL || !judgmentApiKey || !organizationId) {
    throw new Error("Missing required API credentials");
  }

  const client = new JudgmentApiClient(
    JUDGMENT_API_URL,
    judgmentApiKey,
    organizationId
  );
  const response = await client.fetchScorer({ name });
  const { created_at, updated_at, ...config } = response.scorer;
  return config;
}

export async function scorerExists(
  name: string,
  judgmentApiKey: string = JUDGMENT_API_KEY || "",
  organizationId: string = JUDGMENT_ORG_ID || ""
): Promise<boolean> {
  if (!JUDGMENT_API_URL || !judgmentApiKey || !organizationId) {
    throw new Error("Missing required API credentials");
  }

  const client = new JudgmentApiClient(
    JUDGMENT_API_URL,
    judgmentApiKey,
    organizationId
  );
  const response = await client.scorerExists({ name });
  return response.exists;
}

export class PromptScorer {
  public scoreType: APIScorerType = APIScorerType.PROMPT_SCORER;
  public name: string;
  public prompt: string;
  public threshold: number;
  public options?: Record<string, number> | null;
  public judgmentApiKey: string;
  public organizationId: string;

  constructor(
    name: string,
    prompt: string,
    threshold: number,
    options?: Record<string, number> | null,
    judgmentApiKey: string = JUDGMENT_API_KEY || "",
    organizationId: string = JUDGMENT_ORG_ID || ""
  ) {
    this.name = name;
    this.prompt = prompt;
    this.threshold = threshold;
    this.options = options;
    this.judgmentApiKey = judgmentApiKey;
    this.organizationId = organizationId;
  }

  static async get(
    name: string,
    judgmentApiKey: string = JUDGMENT_API_KEY || "",
    organizationId: string = JUDGMENT_ORG_ID || ""
  ): Promise<PromptScorer> {
    const config = await fetchPromptScorer(
      name,
      judgmentApiKey,
      organizationId
    );
    return new PromptScorer(
      name,
      config.prompt,
      config.threshold,
      config.options,
      judgmentApiKey,
      organizationId
    );
  }

  static async create(
    name: string,
    prompt: string,
    threshold: number = 0.5,
    options?: Record<string, number> | null,
    judgmentApiKey: string = JUDGMENT_API_KEY || "",
    organizationId: string = JUDGMENT_ORG_ID || ""
  ): Promise<PromptScorer> {
    if (await scorerExists(name, judgmentApiKey, organizationId)) {
      throw new JudgmentAPIError(
        400,
        `Scorer with name ${name} already exists. Use get() method or choose a new name.`
      );
    }

    await pushPromptScorer(
      name,
      prompt,
      threshold,
      options,
      judgmentApiKey,
      organizationId,
      false
    );
    return new PromptScorer(
      name,
      prompt,
      threshold,
      options,
      judgmentApiKey,
      organizationId
    );
  }

  async setThreshold(threshold: number): Promise<void> {
    this.threshold = threshold;
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
      this.organizationId
    );
  }

  toString(): string {
    return `PromptScorer(name=${this.name}, prompt=${this.prompt}, threshold=${
      this.threshold
    }, options=${JSON.stringify(this.options)})`;
  }
}
