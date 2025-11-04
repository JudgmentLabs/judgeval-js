import { JUDGMENT_API_KEY, JUDGMENT_ORG_ID } from "../../../env";
import { BasePromptScorer } from "./base-prompt-scorer";
import {
  fetchPromptScorer,
  JudgmentAPIError,
  scorerExists,
} from "./prompt-scorer-utils";

export { fetchPromptScorer, JudgmentAPIError, scorerExists };

export class PromptScorer extends BasePromptScorer {
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
      "Prompt Scorer",
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
    return "Prompt Scorer";
  }

  protected getIsTrace(): boolean {
    return false;
  }

  static async get(
    name: string,
    judgmentApiKey: string = JUDGMENT_API_KEY ?? "",
    organizationId: string = JUDGMENT_ORG_ID ?? "",
  ): Promise<PromptScorer> {
    const config = await fetchPromptScorer(
      name,
      judgmentApiKey,
      organizationId,
    );

    if (config.is_trace === true) {
      throw new JudgmentAPIError(
        400,
        `Scorer with name ${name} is a TracePromptScorer, not a PromptScorer`,
      );
    }

    return new PromptScorer(
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
  ): Promise<PromptScorer> {
    if (await scorerExists(name, judgmentApiKey, organizationId)) {
      throw new JudgmentAPIError(
        400,
        `Scorer with name ${name} already exists. Either use the existing scorer with the get() method or use a new name.`,
      );
    }

    const scorer = new PromptScorer(
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
