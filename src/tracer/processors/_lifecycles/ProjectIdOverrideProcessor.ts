import { trace, type Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { AttributeKeys } from "../../../judgmentAttributeKeys";
import { register } from "./registry";

export class ProjectIdOverrideProcessor implements SpanProcessor {
  onStart(span: Span, parentContext: Context): void {
    const parentSpan = trace.getSpan(parentContext);
    if (parentSpan && "attributes" in parentSpan) {
      const readableSpan = parentSpan as unknown as ReadableSpan;
      const projectIdOverride =
        readableSpan.attributes[AttributeKeys.JUDGMENT_PROJECT_ID_OVERRIDE];
      if (projectIdOverride !== undefined) {
        span.setAttribute(
          AttributeKeys.JUDGMENT_PROJECT_ID_OVERRIDE,
          String(projectIdOverride),
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

register(ProjectIdOverrideProcessor);
