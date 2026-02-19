import { OpenAIInstrumentation } from "@opentelemetry/instrumentation-openai";
import { NodeTracer } from "judgeval";

NodeTracer.registerOTELInstrumentation(
  new OpenAIInstrumentation({ captureMessageContent: true }),
);
