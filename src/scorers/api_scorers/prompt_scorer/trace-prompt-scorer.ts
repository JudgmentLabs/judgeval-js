import { JUDGMENT_API_KEY, JUDGMENT_ORG_ID } from "../../../env";
import { BasePromptScorer } from "./base-prompt-scorer";
import {
  fetchPromptScorer,
  JudgmentAPIError,
  scorerExists,
} from "./prompt-scorer-utils";

export class TracePromptScorer extends BasePromptScorer {
  private constructor(
    name: string,
    prompt: string,
    threshold: number,
    model: string | null,
    options?: Record<string, number> | null,
    description?: string | null,
    judgmentApiKey: string = JUDGMENT_API_KEY ?? "",
    organizationId: string = JUDGMENT_ORG_ID ?? "",
  ) {
    super(
      "Trace Prompt Scorer",
      name,
      prompt,
      threshold,
      model,
      options,
      description,
      judgmentApiKey,
      organizationId,
    );
  }

  protected getScoreType(): string {
    return "Trace Prompt Scorer";
  }

  protected getIsTrace(): boolean {
    return true;
  }

  static async get(
    name: string,
    judgmentApiKey: string = JUDGMENT_API_KEY ?? "",
    organizationId: string = JUDGMENT_ORG_ID ?? "",
  ): Promise<TracePromptScorer> {
    const config = await fetchPromptScorer(
      name,
      judgmentApiKey,
      organizationId,
    );

    if (config.is_trace !== true) {
      throw new JudgmentAPIError(
        400,
        `Scorer with name ${name} is a PromptScorer, not a TracePromptScorer`,
      );
    }

    return new TracePromptScorer(
      config.name,
      config.prompt,
      config.threshold,
      config.model ?? null,
      config.options,
      config.description,
      judgmentApiKey,
      organizationId,
    );
  }

  static async create(
    name: string,
    prompt: string,
    threshold = 0.5,
    model: string | null = null,
    options?: Record<string, number> | null,
    description?: string | null,
    judgmentApiKey: string = JUDGMENT_API_KEY ?? "",
    organizationId: string = JUDGMENT_ORG_ID ?? "",
  ): Promise<TracePromptScorer> {
    if (await scorerExists(name, judgmentApiKey, organizationId)) {
      throw new JudgmentAPIError(
        400,
        `Scorer with name ${name} already exists. Either use the existing scorer with the get() method or use a new name.`,
      );
    }

    const scorer = new TracePromptScorer(
      name,
      prompt,
      threshold,
      model,
      options,
      description,
      judgmentApiKey,
      organizationId,
    );

    await scorer.pushPromptScorer();

    return scorer;
  }
}
