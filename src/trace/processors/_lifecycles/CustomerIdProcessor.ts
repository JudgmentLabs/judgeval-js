import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { AttributeKeys } from "../../../judgmentAttributeKeys";
import { CUSTOMER_ID_KEY } from "./contextKeys";
import { register } from "./registry";

class CustomerIdProcessor implements SpanProcessor {
  onStart(span: Span, parentContext: Context): void {
    const customerId = parentContext.getValue(CUSTOMER_ID_KEY);
    if (customerId != null) {
      span.setAttribute(AttributeKeys.JUDGMENT_CUSTOMER_ID, String(customerId));
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

register(() => new CustomerIdProcessor());

export { CustomerIdProcessor };
