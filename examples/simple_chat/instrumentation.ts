import { OpenAIInstrumentation } from "@opentelemetry/instrumentation-openai";
import { SamplingDecision } from "@opentelemetry/sdk-trace-base";
import {
  ExperimentalSpanFilterSampler,
  Judgeval,
  type NodeTracer,
} from "judgeval";

export const client = Judgeval.create();

const initPromise = client.nodeTracer.create({
  projectName: "auto_instrumentation_example",
  instrumentations: [new OpenAIInstrumentation()],
  sampler: new ExperimentalSpanFilterSampler({
    filter: (span) => {
      console.log(span);
      return span.resource.attributes["service.name"] === "judgeval"
        ? SamplingDecision.RECORD_AND_SAMPLED
        : SamplingDecision.NOT_RECORD;
    },
  }),
});

export async function getTracer(): Promise<NodeTracer> {
  return await initPromise;
}
