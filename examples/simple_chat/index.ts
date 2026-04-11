import "./instrumentation";

import { Tracer } from "judgeval";
import OpenAI from "openai";

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

const chatWithUser = Tracer.observe(async function _chatWithUser(
  userMessage: string,
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: userMessage },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
  });

  const result = completion.choices[0].message.content || "";

  console.log(`User: ${userMessage}`);
  console.log(`Assistant: ${result}`);

  Tracer.asyncEvaluate("Sentiment");
  return result;
});

async function main() {
  await Tracer.init({ projectName: "js-new" });
  await Tracer.with("main", async () => {
    Tracer.setCustomerId("customer-123");
    Tracer.setSessionId(`session-${Date.now()}`);
    Tracer.setCustomerUserId(`user-${Math.random().toString(36).substring(2, 15)}`);
    const result = await chatWithUser("What is the capital of France?");
    console.log(result);
  });

  await Tracer.forceFlush();
  await Tracer.shutdown();
}

main().catch(console.error);
