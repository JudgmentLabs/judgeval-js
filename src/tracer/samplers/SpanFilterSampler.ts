import {
  type Attributes,
  type Context,
  type Link,
  type SpanKind,
} from "@opentelemetry/api";
import {
  ReadableSpan,
  SamplingDecision,
  type Sampler,
  type SamplingResult,
} from "@opentelemetry/sdk-trace-base";
import { SpanImpl } from "@opentelemetry/sdk-trace-base/build/src/Span";
import { Logger } from "../../utils";

// @ref https://github.com/open-telemetry/opentelemetry-js/blob/main/api/src/trace/context-utils.ts
const SPAN_KEY_NAME = "OpenTelemetry Context Key SPAN";

export class SpanFilterSampler implements Sampler {
  constructor(
    private readonly filterFn: (span: ReadableSpan) => SamplingDecision,
  ) {}

  shouldSample(
    context: Context,
    _traceId: string,
    _spanName: string,
    _spanKind: SpanKind,
    _attributes: Attributes,
    _links: Link[],
  ): SamplingResult {
    // @ts-expect-error unofficial but will exist
    const currentContext = context._currentContext as Map<symbol, unknown>;
    if (!(currentContext instanceof Map)) {
      return {
        decision: SamplingDecision.RECORD_AND_SAMPLED,
      };
    }

    const spanKey = Array.from(currentContext.keys()).find(
      (key) => key.description === SPAN_KEY_NAME,
    );

    // // @ref https://github.com/open-telemetry/opentelemetry-js/blob/main/api/src/context/context.ts
    const span = spanKey ? currentContext.get(spanKey) : undefined;
    if (!(span instanceof SpanImpl)) {
      return {
        decision: SamplingDecision.RECORD_AND_SAMPLED,
      };
    }

    const decision = this.filterFn(span);
    if (decision === SamplingDecision.NOT_RECORD) {
      Logger.info(
        `[SpanFilterSampler] Dropping span ${span.spanContext().spanId} because it does not match the filter function`,
      );
    }

    return { decision };
  }
}
