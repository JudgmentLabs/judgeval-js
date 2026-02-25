import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { JudgmentTracerProvider, Tracer } from "judgeval";

JudgmentTracerProvider.installAsGlobalTracerProvider();
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is not set`);
  return value;
}

requireEnv("OPENAI_API_KEY");


const chatWithUser = Tracer.observe(async function _chatWithUser(userMessage: string): Promise<string> {
  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    system: "You are a helpful assistant.",
    prompt: userMessage,
    experimental_telemetry: { isEnabled: true },
  });

  console.log(`User: ${userMessage}`);
  console.log(`Assistant: ${text}`);

  return text;
});

(async () => {
  await Tracer.init({ projectName: "ai-sdk-example" });
  const result = await chatWithUser("What is the capital of France?");
  console.log(result);
  await Tracer.forceFlush();
  await Tracer.shutdown();
})();