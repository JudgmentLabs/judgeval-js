import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import type { Maybe } from "../../../utils/type-helpers";
import { SESSION_ID_KEY } from "./contextKeys";
import { register } from "./registry";

class SessionIdProcessor implements SpanProcessor {
  onStart(span: Span, parentContext: Context): void {
    const sessionId = parentContext.getValue(SESSION_ID_KEY) as Maybe<string>;
    if (sessionId) {
      span.setAttribute(AttributeKeys.JUDGMENT_SESSION_ID, sessionId);
    }
  }

  onEnd(_span: ReadableSpan): void {
    /* empty */
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

register(() => new SessionIdProcessor());
export { SessionIdProcessor };
