import OpenAI from "openai";
import {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";

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
}
