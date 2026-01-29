import type { SpanProcessor } from "@opentelemetry/sdk-trace-base";

type ProcessorClass = new () => SpanProcessor;

const processors: ProcessorClass[] = [];

export function register(processorClass: ProcessorClass): void {
  processors.push(processorClass);
}

export function getAll(): SpanProcessor[] {
  return processors.map((P) => new P());
}
