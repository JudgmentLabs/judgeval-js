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
    name: string,
    prompt: string,
    threshold: number,
    options?: Record<string, number> | null,
    judgmentApiKey: string = JUDGMENT_API_KEY || "",
    organizationId: string = JUDGMENT_ORG_ID || "",
  ) {
    super(
      APIScorerType.PROMPT_SCORER,
      name,
      prompt,
      threshold,
      options,
      judgmentApiKey,
      organizationId,
    );
  }
}
