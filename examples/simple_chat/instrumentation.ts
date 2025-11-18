import { OpenAIInstrumentation } from "@opentelemetry/instrumentation-openai";
import { Judgeval, type NodeTracer } from "judgeval";

export const client = Judgeval.create();

const initPromise = client.nodeTracer.create({
  projectName: "auto_instrumentation_example",
  instrumentations: [new OpenAIInstrumentation()],
  filterTracer: ({ name }) => {
    return name === "judgeval";
  },
});

export async function getTracer(): Promise<NodeTracer> {
  return await initPromise;
}
