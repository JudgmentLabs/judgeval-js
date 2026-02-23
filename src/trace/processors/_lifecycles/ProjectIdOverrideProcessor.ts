import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { AttributeKeys } from "../../../judgmentAttributeKeys";
import type { Maybe } from "../../../utils/type-helpers";
import { PROJECT_ID_OVERRIDE_KEY } from "./contextKeys";
import { register } from "./registry";

class ProjectIdOverrideProcessor implements SpanProcessor {
  onStart(span: Span, parentContext: Context): void {
    const projectIdOverride = parentContext.getValue(
      PROJECT_ID_OVERRIDE_KEY,
    ) as Maybe<string>;
    if (projectIdOverride) {
      span.setAttribute(
        AttributeKeys.JUDGMENT_PROJECT_ID_OVERRIDE,
        projectIdOverride,
      );
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

register(() => new ProjectIdOverrideProcessor());
export { ProjectIdOverrideProcessor };
