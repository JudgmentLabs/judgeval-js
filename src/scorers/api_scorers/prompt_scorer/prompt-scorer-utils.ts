import {
  JUDGMENT_API_KEY,
  JUDGMENT_API_URL,
  JUDGMENT_ORG_ID,
} from "../../../env";
import { JudgmentApiClient } from "../../../internal/api";

export class JudgmentAPIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "JudgmentAPIError";
  }
}

export async function pushPromptScorer(
  name: string,
  prompt: string,
  threshold: number,
  model: string | null,
  options?: Record<string, number> | null,
  description?: string | null,
  judgmentApiKey: string = JUDGMENT_API_KEY ?? "",
  organizationId: string = JUDGMENT_ORG_ID ?? "",
  isTrace?: boolean,
): Promise<string> {
  if (!JUDGMENT_API_URL || !judgmentApiKey || !organizationId) {
    throw new Error("Missing required API credentials");
  }

  const client = new JudgmentApiClient(
    JUDGMENT_API_URL,
    judgmentApiKey,
    organizationId,
  );
  const response = await client.saveScorer({
    name,
    prompt,
    threshold,
    model: model ?? undefined,
    options,
    description,
    is_trace: isTrace,
  });
  return response.name;
}

export async function fetchPromptScorer(
  name: string,
  judgmentApiKey: string = JUDGMENT_API_KEY ?? "",
  organizationId: string = JUDGMENT_ORG_ID ?? "",
) {
  if (!JUDGMENT_API_URL || !judgmentApiKey || !organizationId) {
    throw new Error("Missing required API credentials");
  }

  const client = new JudgmentApiClient(
    JUDGMENT_API_URL,
    judgmentApiKey,
    organizationId,
  );
  const response = await client.fetchScorers({ names: [name] });
  if (response.scorers.length === 0) {
    throw new JudgmentAPIError(404, `Scorer with name ${name} not found`);
  }
  return response.scorers[0];
}

export async function scorerExists(
  name: string,
  judgmentApiKey: string = JUDGMENT_API_KEY ?? "",
  organizationId: string = JUDGMENT_ORG_ID ?? "",
): Promise<boolean> {
  if (!JUDGMENT_API_URL || !judgmentApiKey || !organizationId) {
    throw new Error("Missing required API credentials");
  }

  const client = new JudgmentApiClient(
    JUDGMENT_API_URL,
    judgmentApiKey,
    organizationId,
  );
  const response = await client.scorerExists({ name });
  return response.exists;
}
