import { OpenAIInstrumentation } from "@opentelemetry/instrumentation-openai";
import { Judgeval, type NodeTracer } from "judgeval/v1";

export const client = Judgeval.create();

let _tracer: NodeTracer | null = null;

const initPromise = client.nodeTracer
  .create({
    projectName: "auto_instrumentation_example",
    enableEvaluation: true,
    enableMonitoring: true,
    instrumentations: [new OpenAIInstrumentation()],
    initialize: true,
  })
  .then((t: NodeTracer) => {
    _tracer = t;
    return t;
  });

export async function getTracer(): Promise<NodeTracer> {
  if (!_tracer) {
    await initPromise;
  }
  return _tracer!;
}
