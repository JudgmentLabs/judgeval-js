import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { AttributeKeys } from "../../../judgmentAttributeKeys";
import type { Maybe } from "../../../utils/type-helpers";
import { CUSTOMER_ID_KEY } from "./contextKeys";
import { register } from "./registry";

class CustomerIdProcessor implements SpanProcessor {
  onStart(span: Span, parentContext: Context): void {
    const customerId = parentContext.getValue(CUSTOMER_ID_KEY) as Maybe<string>;
    if (customerId) {
      span.setAttribute(AttributeKeys.JUDGMENT_CUSTOMER_ID, customerId);
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

register(() => new CustomerIdProcessor());
export { CustomerIdProcessor };
