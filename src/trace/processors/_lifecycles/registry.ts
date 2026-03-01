import type { SpanProcessor } from "@opentelemetry/sdk-trace-base";

type ProcessorFactory = () => SpanProcessor;
const processors: ProcessorFactory[] = [];

export function register(processorFactory: ProcessorFactory): void {
  processors.push(processorFactory);
}

export function getAll(): SpanProcessor[] {
  return processors.map((factory) => factory());
}

export function clear(): void {
  processors.length = 0;
}
