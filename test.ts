import "dotenv/config";
import { createExample } from "./src/data/example";
import { PromptScorer } from "./src/scorers/api_scorers/prompt-scorer";
import { Tracer } from "./src/tracer/Tracer";

async function testRegularScorer() {
  console.log("Starting test-regular-scorer example...");

  const tracer = Tracer.createDefault("ahh");

  const scorer = await PromptScorer.get(
    "test-regular-scorer",
    process.env.JUDGMENT_API_KEY || "",
    process.env.JUDGMENT_ORG_ID || ""
  );

  const example = createExample({
    input: "What is the capital of France?",
    actual_output:
      "The capital of France is Paris, which is located in the north-central part of the country.",
  });

  console.log("Example created:", example);

  const processInput = tracer.observe(
    "process-user-input",
    (input: string) => {
      tracer.setInput({
        input: input,
      });

      console.log(`Processing input: ${input}`);

      const response =
        "The capital of France is Paris, which is located in the north-central part of the country.";

      tracer.asyncEvaluate(scorer, example, "gpt-4");

      tracer.setOutput({
        response: response,
      });

      return response;
    },
    "llm" 
  );

  const result = processInput(example.input);
  console.log("Function result:", result);
  await tracer.forceFlush();

  console.log("Test completed!");
}

testRegularScorer().catch(console.error);
