import { JUDGMENT_DEFAULT_GPT_MODEL } from "../../env";
import { JudgmentApiClient } from "../../internal/api";
import type { PromptScorer as APIPromptScorer } from "../../internal/api";
import { Logger } from "../../utils";
import { resolveProjectId } from "../../utils/resolveProjectId";
import { PromptScorer } from "./PromptScorer";

export class PromptScorerFactory {
  private readonly client: JudgmentApiClient;
  private readonly isTrace: boolean;
  private static readonly cache = new Map<string, APIPromptScorer>();

  constructor(client: JudgmentApiClient, isTrace: boolean) {
    this.client = client;
    this.isTrace = isTrace;
  }

  async get(projectName: string, name: string): Promise<PromptScorer | null> {
    const cacheKey = this.getCacheKey(name);
    const cached = PromptScorerFactory.cache.get(cacheKey);

    if (cached) {
      return this._create(cached, name);
    }

    try {
      const projectId = await resolveProjectId(this.client, projectName);
      const response = await this.client.getV1projectsScorers(
        projectId,
        name,
        this.isTrace ? "true" : "false",
      );

      if (response.scorers.length === 0) {
        throw new Error(`Failed to fetch prompt scorer '${name}': not found`);
      }

      const scorer = response.scorers[0];
      const scorerIsTrace = scorer.is_trace === true;

      if (scorerIsTrace !== this.isTrace) {
        const expectedType = this.isTrace
          ? "TracePromptScorer"
          : "PromptScorer";
        const actualType = scorerIsTrace ? "TracePromptScorer" : "PromptScorer";
        throw new Error(
          `Scorer with name ${name} is a ${actualType}, not a ${expectedType}`,
        );
      }

      PromptScorerFactory.cache.set(cacheKey, scorer);
      return this._create(scorer, name);
    } catch (error) {
      Logger.error(`Failed to fetch prompt scorer '${name}': ${error}`);
      return null;
    }
  }

  private _create(scorer: APIPromptScorer, name: string): PromptScorer {
    let options: Record<string, number> | undefined;
    if (scorer.options && typeof scorer.options === "object") {
      options = {};
      for (const [key, value] of Object.entries(scorer.options)) {
        if (typeof value === "number") {
          options[key] = value;
        }
      }
    }

    return new PromptScorer({
      name,
      prompt: scorer.prompt,
      threshold: scorer.threshold,
      options: options ?? {},
      model: scorer.model ?? JUDGMENT_DEFAULT_GPT_MODEL,
      description: scorer.description ?? "",
      isTrace: this.isTrace,
    });
  }

  private getCacheKey(name: string): string {
    return `${name}:${this.client.getApiKey()}:${this.client.getOrganizationId()}`;
  }
}
