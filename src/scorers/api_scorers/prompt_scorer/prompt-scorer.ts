import { JUDGMENT_API_KEY, JUDGMENT_ORG_ID } from "../../../env";
import { APIScorerType } from "../../api-scorer";
import { BasePromptScorer } from "./base-prompt-scorer";
export {
  fetchPromptScorer,
  JudgmentAPIError,
  pushPromptScorer,
  scorerExists,
} from "./prompt-scorer-utils";

export class PromptScorer extends BasePromptScorer {
  constructor(
    scoreType: APIScorerType,
    name: string,
    prompt: string,
    threshold: number,
    requiredParams: readonly string[] = [],
    options?: Record<string, number> | null,
    judgmentApiKey: string = JUDGMENT_API_KEY ?? "",
    organizationId: string = JUDGMENT_ORG_ID ?? "",
  ) {
    super(
      scoreType,
      name,
      prompt,
      threshold,
      requiredParams,
      options,
      judgmentApiKey,
      organizationId,
    );
  }
}
