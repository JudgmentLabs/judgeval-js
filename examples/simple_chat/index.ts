import { trace } from "@opentelemetry/api";
import OpenAI from "openai";
import { tracer } from "./instrumentation";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}

const OPENAI_API_KEY = requireEnv("OPENAI_API_KEY");

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

async function chatWithUser(userMessage: string): Promise<string> {
  const tracer = trace.getTracer("simple_chat");

  return tracer.startActiveSpan("chat_interaction", async (span) => {
    try {
      span.setAttribute("judgment.input", userMessage);

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: userMessage },
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
      });

      const result = completion.choices[0].message.content || "";

      span.setAttribute("judgment.output", result);

      console.log(`User: ${userMessage}`);
      console.log(`Assistant: ${result}`);

      return result;
    } finally {
      span.end();
    }
  });
}

if (import.meta.main) {
  const result = await chatWithUser("What is the capital of France?");
  console.log(result);

  await tracer.shutdown();
}
