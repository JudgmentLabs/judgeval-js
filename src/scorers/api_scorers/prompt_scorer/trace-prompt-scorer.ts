import { JUDGMENT_API_KEY, JUDGMENT_ORG_ID } from "../../../env";
import { APIScorerType } from "../../api-scorer";
import { BasePromptScorer } from "./base-prompt-scorer";

export class TracePromptScorer extends BasePromptScorer {
  constructor(
    name: string,
    prompt: string,
    threshold: number,
    options?: Record<string, number> | null,
    judgmentApiKey: string = JUDGMENT_API_KEY || "",
    organizationId: string = JUDGMENT_ORG_ID || "",
  ) {
    super(
      APIScorerType.TRACE_PROMPT_SCORER,
      name,
      prompt,
      threshold,
      options,
      judgmentApiKey,
      organizationId,
    );
  }
}
