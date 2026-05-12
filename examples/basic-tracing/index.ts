import { Tracer, wrap } from "judgeval";
import OpenAI from "openai";

const client = wrap(new OpenAI());

const add = Tracer.observe(async function _add(
  a: number,
  b: number,
): Promise<number> {
  Tracer.asyncEvaluate({ judge: "Calculator" });
  const response = await client.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a calculator. You are given two integers and you need to return the sum of the two integers. Return the answer as an integer no extra text. Answer only the number, no other text, formatting, or markdown.",
      },
      {
        role: "user",
        content: `${a} + ${b}`,
      },
    ],
    max_completion_tokens: 256,
  });

  const result = response.choices[0]?.message.content ?? "";
  if (result && /^\d+$/.test(result)) {
    return parseInt(result, 10);
  }
  throw new Error(`Invalid response: ${result}`);
});

async function main() {
  await Tracer.init({ projectName: "default_project" });
  const result = await add(1, 2);
  console.log(`Result: ${result}`);
  await Tracer.forceFlush();
  await Tracer.shutdown();
}

main().catch(console.error);
