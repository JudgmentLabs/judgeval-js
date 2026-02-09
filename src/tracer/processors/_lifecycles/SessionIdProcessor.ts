import { trace, type Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { AttributeKeys } from "../../../judgmentAttributeKeys";
import { register } from "./registry";

export class SessionIdProcessor implements SpanProcessor {
  onStart(span: Span, parentContext: Context): void {
    const parentSpan = trace.getSpan(parentContext);
    if (parentSpan && "attributes" in parentSpan) {
      const readableSpan = parentSpan as unknown as ReadableSpan;
      const sessionId =
        readableSpan.attributes[AttributeKeys.JUDGMENT_SESSION_ID];
      if (sessionId !== undefined) {
        span.setAttribute(AttributeKeys.JUDGMENT_SESSION_ID, String(sessionId));
      }
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

register(SessionIdProcessor);
