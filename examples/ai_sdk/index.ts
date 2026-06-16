import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { Tracer } from "judgeval";

const chatWithUser = Tracer.observe(async function chatWithUser(
  userMessage: string,
): Promise<string> {
  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    system: "You are a helpful assistant.",
    prompt: userMessage,
    experimental_telemetry: { isEnabled: true, tracer: Tracer.getOTELTracer() },
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
})().catch(console.error);
