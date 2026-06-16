import { openai } from "@ai-sdk/openai";
import {
  generateText,
  streamText,
  type LanguageModelRequestMetadata,
  type LanguageModelResponseMetadata,
  type LanguageModelUsage,
} from "ai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { Tracer } from "judgeval";

function recordAISDKTelemetry(
  model: LanguageModelV3,
  request: LanguageModelRequestMetadata,
  response: LanguageModelResponseMetadata,
  usage: LanguageModelUsage,
) {
  Tracer.setInput(request.body);
  Tracer.setOutput(response);
  Tracer.recordLLMMetadata({
    model: response.modelId,
    provider: model.provider,
    non_cached_input_tokens: usage.inputTokenDetails.noCacheTokens,
    output_tokens: usage.outputTokens,
    cache_read_input_tokens: usage.inputTokenDetails.cacheReadTokens,
    cache_creation_input_tokens: usage.inputTokenDetails.cacheWriteTokens,
  });
}

function chatWithUser(userMessage: string): Promise<string> {
  return Tracer.span("chatWithUser", async () => {
    const system = "You are a helpful assistant.";
    const model = openai("gpt-4o-mini");
    const { request, response, text, usage } = await generateText({
      model,
      system,
      prompt: userMessage,
    });
    recordAISDKTelemetry(model, request, response, usage);
    return text;
  });
}

function streamChatWithUser(userMessage: string): Promise<string> {
  return Tracer.span("streamChatWithUser", async () => {
    const system = "You are a helpful assistant.";
    const model = openai("gpt-4o-mini");
    const result = streamText({
      model,
      system,
      prompt: userMessage,
    });

    let text = "";
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      text += chunk;
    }
    process.stdout.write("\n");

    const [request, response, usage] = await Promise.all([
      result.request,
      result.response,
      result.usage,
    ]);
    recordAISDKTelemetry(model, request, response, usage);
    return text;
  });
}

(async () => {
  await Tracer.init({ projectName: "ai-sdk-manual-example" });
  const result = await chatWithUser("What is the capital of France?");
  console.log(result);
  const streamed = await streamChatWithUser("What is the capital of Germany?");
  console.log(streamed);
  await Tracer.forceFlush();
  await Tracer.shutdown();
})().catch(console.error);
