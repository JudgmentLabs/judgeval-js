/**
 * Offline tracer + evaluation example.
 *
 * Demonstrates running an agent over a small "golden" eval set with the
 * offline tracer exposed via `Judgeval`. Each iteration:
 *
 *   1. Calls `judgeval.offlineTracer({ ... })` with the same `dataset`
 *      list and per-item `exampleFields` (input + golden_output).
 *   2. Runs the agent against the dataset item.
 *   3. Force-flushes spans so they reach the offline endpoint before
 *      the next item starts a new tracer.
 *
 * After the loop, `dataset` is a list of `Example` objects, each
 * carrying the `offline_trace_id` plus the `exampleFields`. These spans
 * land in the `offline_otel_traces` ClickHouse table and do not show up
 * on the live monitoring page. We then feed the dataset into an
 * evaluation that scores each trace with the hosted
 * `Golden Output Trace Checker` scorer, which fetches the agent's
 * actual output server-side via `offline_trace_id` and compares it
 * against the static `golden_output` field.
 */

import { Example, Judgeval, Tracer, wrap } from "judgeval";
import OpenAI from "openai";

interface GoldenItem {
  input: string;
  golden_output: string;
}

const evalDataset: GoldenItem[] = [
  { input: "What is the capital of France?", golden_output: "Paris" },
  { input: "What is the capital of Japan?", golden_output: "Tokyo" },
  { input: "What is the capital of Brazil?", golden_output: "Brasília" },
];

function buildAgent() {
  const openai = wrap(new OpenAI());

  const formatTask = Tracer.observe(
    function formatTask(question: string): string {
      return (
        "Answer the following question with the city name only, " +
        `no extra words: ${question}`
      );
    },
    { spanType: "tool" },
  );

  const callLLM = Tracer.observe(
    async function callLLM(prompt: string): Promise<string> {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
      });
      return response.choices[0]?.message.content ?? "";
    },
    { spanType: "llm" },
  );

  const runAgent = Tracer.observe(
    async function runAgent(question: string): Promise<string> {
      const prompt = formatTask(question);
      return await callLLM(prompt);
    },
    { spanType: "agent" },
  );

  return runAgent;
}

async function main() {
  if (!process.env.JUDGMENT_API_KEY) {
    throw new Error("JUDGMENT_API_KEY must be set");
  }

  const judgeval = await Judgeval.create({ projectName: "default_project" });
  const runAgent = buildAgent();

  const dataset: Example[] = [];

  for (const item of evalDataset) {
    await judgeval.offlineTracer({
      dataset,
      exampleFields: {
        input: item.input,
        golden_output: item.golden_output,
      },
    });
    try {
      const actualOutput = await runAgent(item.input);
      console.log(
        `input=${JSON.stringify(item.input)} ` +
          `golden=${JSON.stringify(item.golden_output)} ` +
          `actual=${JSON.stringify(actualOutput)}`,
      );
    } finally {
      // Flush the current tracer's spans to the offline endpoint
      // before the next iteration registers a new active tracer.
      await Tracer.forceFlush();
    }
  }

  console.log(`\nCollected ${dataset.length} offline examples.`);

  const evaluation = judgeval.evaluation.create();
  const results = await evaluation.run({
    examples: dataset,
    scorers: ["Golden Output Trace Checker"],
    evalRunName: "offline-trace-eval",
  });

  for (const result of results) {
    console.log(`Success: ${result.success}`);
    for (const scorer of result.scorers) {
      console.log(
        `  ${scorer.name}: score=${scorer.score}, reason=${scorer.reason}`,
      );
    }
  }

  await Tracer.shutdown();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
