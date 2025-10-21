import OpenAI from "openai";
import {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import {
  ANTHROPIC_API_KEY,
  GEMINI_API_KEY,
  GOOGLE_API_KEY,
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
type LLMProviderValue = `${LLMProvider}`;
export type LLMProviderModel = `${LLMProviderValue}/${string}`;

export class LLMClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly organizationId: string,
  ) {}

  public async completion(
    params: ChatCompletionCreateParamsNonStreaming,
  ): Promise<ChatCompletion> {
    const [provider, modelName] = params.model.split("/");

    let provider_api_key: string | null = null;
    switch (provider) {
      case LLMProvider.OPENAI:
        provider_api_key = OPENAI_API_KEY;
        break;
      case LLMProvider.ANTHROPIC:
        provider_api_key = ANTHROPIC_API_KEY;
        break;
      case LLMProvider.GEMINI:
        provider_api_key = GEMINI_API_KEY ?? GOOGLE_API_KEY;
        break;
      default:
        throw new Error(
          `Unsupported provider: ${provider}. Specify the provider in the model name as provider/model (e.g. openai/gpt-4.1). Available providers: ${Object.values(LLMProvider).join(", ")}.`,
        );
    }

    if (!provider_api_key) {
      throw new Error(`API key is not set for provider: ${provider}`);
    }

    const client = new OpenAI({
      apiKey: provider_api_key,
      baseURL: this.baseUrl,
      defaultHeaders: {
        "X-Provider": provider,
        "X-Api-Key": this.apiKey,
        "X-Organization-Id": this.organizationId,
      },
    });
    return await client.chat.completions.create({
      ...params,
      model: modelName,
    });
  }
}

if (import.meta.main) {
  if (!JUDGMENT_LLM_PROXY_URL || !JUDGMENT_API_KEY || !JUDGMENT_ORG_ID) {
    throw new Error(
      "JUDGMENT_LLM_PROXY_URL, JUDGMENT_API_KEY, and JUDGMENT_ORG_ID must be set",
    );
  }
  const llm = new LLMClient(
    JUDGMENT_LLM_PROXY_URL,
    JUDGMENT_API_KEY,
    JUDGMENT_ORG_ID,
  );
  const response = await llm.completion({
    model: "openai/gpt-4.1",
    messages: [{ role: "user", content: "Hello, how are you?" }],
  });
  console.log(response);
}
