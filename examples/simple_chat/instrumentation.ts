import { JudgmentClient } from "judgeval/v1";
import { OpenAIInstrumentation } from "@opentelemetry/instrumentation-openai";

export const client = JudgmentClient.create();

export const tracer = await client.nodeTracer.create({
  projectName: "auto_instrumentation_example",
  enableEvaluation: true,
  enableMonitoring: true,
  instrumentations: [new OpenAIInstrumentation()],
  initialize: true,
});

