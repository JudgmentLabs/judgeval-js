import { trace, type Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { AttributeKeys } from "../../../judgmentAttributeKeys";
import { register } from "./registry";

export class CustomerIdProcessor implements SpanProcessor {
  onStart(span: Span, parentContext: Context): void {
    const parentSpan = trace.getSpan(parentContext);
    if (parentSpan && "attributes" in parentSpan) {
      const readableSpan = parentSpan as unknown as ReadableSpan;
      const customerId =
        readableSpan.attributes[AttributeKeys.JUDGMENT_CUSTOMER_ID];
      if (customerId !== undefined) {
        span.setAttribute(
          AttributeKeys.JUDGMENT_CUSTOMER_ID,
          String(customerId),
        );
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

register(CustomerIdProcessor);
