import { Example } from "./data";
import { JUDGMENT_API_KEY, JUDGMENT_ORG_ID } from "./env";
import { ScoringResult } from "./internal/api/models";
import { BaseScorer } from "./scorers";

export class JudgmentClient {
  private apiKey: string;
  private organizationId: string;

  public constructor(
    apiKey: string | null = JUDGMENT_API_KEY,
    organizationId: string | null = JUDGMENT_ORG_ID,
  ) {
    if (!apiKey || !organizationId) {
      throw new Error("API key and organization ID are required");
    }

    this.apiKey = apiKey;
    this.organizationId = organizationId;
  }

  public runEvaluation(
    examples: Example[],
    scorers: BaseScorer[],
    projectName: string,
    evalRunName: string,
    model?: string,
    assertTest: boolean = false,
  ): Promise<ScoringResult[]> {
    return Promise.resolve([]);
  }
}
