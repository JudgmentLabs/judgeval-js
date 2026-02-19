import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { AttributeKeys } from "../../../judgmentAttributeKeys";
import { SESSION_ID_KEY } from "./contextKeys";
import { register } from "./registry";

class SessionIdProcessor implements SpanProcessor {
  onStart(span: Span, parentContext: Context): void {
    const sessionId = parentContext.getValue(SESSION_ID_KEY);
    if (sessionId != null) {
      span.setAttribute(AttributeKeys.JUDGMENT_SESSION_ID, String(sessionId));
    }
  }

  onEnd(_span: ReadableSpan): void {}
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

register(() => new SessionIdProcessor());

export { SessionIdProcessor };
