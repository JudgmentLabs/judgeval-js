import type { Context } from "@opentelemetry/api";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { BaseTracer } from "../../../trace/BaseTracer";
import { getTraceRuntime } from "../../../trace/runtime";
import type { SpanNode } from "./spans";

/**
 * Export `node` and the spans nested in it as finished spans under `parent`.
 * Each span is started at its recorded time, because the work already happened.
 */
export function writeSpans(
  node: SpanNode,
  parent: Context,
  sessionId: string,
): void {
  const span = BaseTracer.getOTELTracer().startSpan(
    node.name,
    { startTime: node.start },
    parent,
  );
  BaseTracer.setSpanKind(node.kind, span);
  BaseTracer.setAttribute(AttributeKeys.JUDGMENT_SESSION_ID, sessionId, span);
  BaseTracer.setAttributes(node.attributes ?? {}, span);
  BaseTracer.setInput(node.input, span);
  BaseTracer.setOutput(node.output, span);
  if (node.llm) BaseTracer.recordLLMMetadata(node.llm, span);

  const context = getTraceRuntime().setSpan(parent, span);
  for (const child of node.children ?? []) {
    writeSpans(child, context, sessionId);
  }

  if (node.error) BaseTracer.setError(new Error(node.error), span);
  span.end(Math.max(node.end, node.start));
}
