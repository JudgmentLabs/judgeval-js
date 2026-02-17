import { Example, NodeTracer } from "judgeval";
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

async function _chatWithUser(userMessage: string): Promise<string> {
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


  NodeTracer.asyncEvaluate(
    "answer_relevancy",
    [
      Example.create({
        input: "What is the capital of France?",
        actual_output: result,
      })
    ]
  );

  return result;
}

(async () => {
  await NodeTracer.init({ projectName: "js-new" });
  const chatWithUser = NodeTracer.observe(_chatWithUser);

  const result = await chatWithUser("What is the capital of France?");
  console.log(result);

  await NodeTracer.forceFlush();
  await NodeTracer.shutdown();
})();
