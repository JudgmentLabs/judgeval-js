import OpenAI from "openai";
import {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import {
  JUDGMENT_API_KEY,
  JUDGMENT_LLM_PROXY_URL,
  JUDGMENT_ORG_ID,
  OPENAI_API_KEY,
} from "../env";

export enum LLMProvider {
  OPENAI = "openai",
  ANTHROPIC = "anthropic",
  GEMINI = "gemini",
}

export class LLMClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly judgmentApiKey: string;
  private readonly judgmentOrganizationId: string;

  constructor(params: {
    baseUrl: string;
    apiKey: string;
    judgmentApiKey: string;
    judgmentOrganizationId: string;
  }) {
    this.baseUrl = params.baseUrl;
    this.apiKey = params.apiKey;
    this.judgmentApiKey = params.judgmentApiKey;
    this.judgmentOrganizationId = params.judgmentOrganizationId;
  }

  private createOpenAIClient() {
    return new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
      defaultHeaders: {
        "X-Api-Key": this.judgmentApiKey,
        "X-Organization-Id": this.judgmentOrganizationId,
      },
    });
  }

  public async completion(
    params: ChatCompletionCreateParamsNonStreaming,
  ): Promise<ChatCompletion> {
    const client = this.createOpenAIClient();
    return await client.chat.completions.create({
      ...params,
    });
  }

  public async models() {
    const client = this.createOpenAIClient();
    return await client.models.list();
  }
}

if (import.meta.main) {
  if (
    !JUDGMENT_LLM_PROXY_URL ||
    !JUDGMENT_API_KEY ||
    !JUDGMENT_ORG_ID ||
    !OPENAI_API_KEY
  ) {
    throw new Error(
      "JUDGMENT_LLM_PROXY_URL, JUDGMENT_API_KEY, and JUDGMENT_ORG_ID must be set",
    );
  }
  const llm = new LLMClient({
    baseUrl: JUDGMENT_LLM_PROXY_URL,
    apiKey: OPENAI_API_KEY,
    judgmentApiKey: JUDGMENT_API_KEY,
    judgmentOrganizationId: JUDGMENT_ORG_ID,
  });

  const models = await llm.models();
  console.log(models);

  // const response = await llm.completion({
  //   model: "gpt-4.1",
  //   messages: [{ role: "user", content: "Hello, how are you?" }],
  // });
  // console.log(response);
}
