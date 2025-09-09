import { context, trace } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NodeSDK } from "@opentelemetry/sdk-node";
import "dotenv/config";
import { createExample } from "./src/data/example";
import { createAnswerCorrectnessScorer } from "./src/scorers/api_scorers/answer-correctness-scorer";
import { JudgevalTracer } from "./src/tracer";
import { TracerConfiguration } from "./src/tracer/TracerConfiguration";

// Global tracer configuration
const config = TracerConfiguration.builder()
  .projectName("ahh")
  .enableEvaluation(true)
  .build();

const judgevalTracer = JudgevalTracer.createWithConfiguration(config);

async function runTest() {
  console.log("🚀 Starting JudgevalTracer Test");

  const spanExporter = await judgevalTracer.getSpanExporter();

  const sdk = new NodeSDK({
    traceExporter: spanExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  console.log("📊 OpenTelemetry SDK initialized");

  const tracer = trace.getTracer("judgeval-tracer");

  // Create a simple span
  const span = tracer.startSpan("test-operation", {});

  await context.with(trace.setSpan(context.active(), span), async () => {
    console.log("🧮 Running simple operation with async evaluation");

    // Create scorer and example
    const scorer = createAnswerCorrectnessScorer();
    const example = createExample({
      input: "What is 2+2?",
      actual_output: "4",
      expected_output: "4",
    });

    console.log("📝 Scorer required params:", scorer.requiredParams);
    console.log("📄 Example data:", example);

    // This should work - example has all required params
    judgevalTracer.asyncEvaluate(scorer, example, "gpt-4");

    console.log("✅ asyncEvaluate called successfully");

    // This would cause a TypeScript error if uncommented:
    // const badExample = createExample({
    //   input: "What is 2+2?",
    //   actual_output: "4"
    //   // Missing expected_output!
    // });
    // judgevalTracer.asyncEvaluate(scorer, badExample); // ❌ TypeScript error!
  });

  span.end();

  console.log("⏳ Waiting for spans to be exported...");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await sdk.shutdown();
  console.log(
    "✅ Test completed! Check your Judgment Labs dashboard for the traces."
  );
}

runTest().catch(console.error);
