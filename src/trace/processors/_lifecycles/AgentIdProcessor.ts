import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { AttributeKeys } from "../../../judgmentAttributeKeys";
import type { Maybe } from "../../../utils/type-helpers";
import {
  AGENT_CLASS_NAME_KEY,
  AGENT_ID_KEY,
  AGENT_INSTANCE_NAME_KEY,
  PARENT_AGENT_ID_KEY,
} from "./contextKeys";
import { register } from "./registry";

class AgentIdProcessor implements SpanProcessor {
  onStart(span: Span, parentContext: Context): void {
    const agentId = parentContext.getValue(AGENT_ID_KEY) as Maybe<string>;
    if (agentId) span.setAttribute(AttributeKeys.JUDGMENT_AGENT_ID, agentId);

    const parentAgentId = parentContext.getValue(
      PARENT_AGENT_ID_KEY,
    ) as Maybe<string>;
    if (parentAgentId)
      span.setAttribute(AttributeKeys.JUDGMENT_PARENT_AGENT_ID, parentAgentId);

    const className = parentContext.getValue(
      AGENT_CLASS_NAME_KEY,
    ) as Maybe<string>;
    if (className)
      span.setAttribute(AttributeKeys.JUDGMENT_AGENT_CLASS_NAME, className);

    const instanceName = parentContext.getValue(
      AGENT_INSTANCE_NAME_KEY,
    ) as Maybe<string>;
    if (instanceName)
      span.setAttribute(
        AttributeKeys.JUDGMENT_AGENT_INSTANCE_NAME,
        instanceName,
      );

    if (agentId && agentId !== parentAgentId) {
      span.setAttribute(AttributeKeys.JUDGMENT_IS_AGENT_ENTRY_POINT, true);
    }
  }

  onEnd(_span: ReadableSpan): void {
    /* empty */
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

register(() => new AgentIdProcessor());
export { AgentIdProcessor };
