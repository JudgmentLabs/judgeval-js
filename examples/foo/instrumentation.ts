import { OpenAIInstrumentation } from "@opentelemetry/instrumentation-openai";
import { Tracer } from "judgeval";

Tracer.registerOTELInstrumentation(
  new OpenAIInstrumentation({ captureMessageContent: true }),
);
