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
import { Logger } from "../../utils";

// @ref https://github.com/open-telemetry/opentelemetry-js/blob/main/api/src/trace/context-utils.ts
const SPAN_KEY_NAME = "OpenTelemetry Context Key SPAN" as const;

export interface ExperimentalSpanFilterSamplerConfig {
  filter: (span: ReadableSpan) => SamplingDecision;
}
export class ExperimentalSpanFilterSampler implements Sampler {
  constructor(private readonly config: ExperimentalSpanFilterSamplerConfig) {}

  shouldSample(
    context: Context,
    _traceId: string,
    _spanName: string,
    _spanKind: SpanKind,
    _attributes: Attributes,
    _links: Link[]
  ): SamplingResult {
    // @ts-expect-error - not intended to be public API but exists
    const currentContext = context._currentContext as Map<symbol, unknown>;
    if (!(currentContext instanceof Map)) {
      return {
        decision: SamplingDecision.RECORD_AND_SAMPLED,
      };
    }

    const spanKey = Array.from(currentContext.keys()).find(
      (key) => key.description === SPAN_KEY_NAME
    );

    // // @ref https://github.com/open-telemetry/opentelemetry-js/blob/main/api/src/context/context.ts
    const span = spanKey ? currentContext.get(spanKey) : undefined;
    try {
      const decision = this.config.filter(span as ReadableSpan);
      if (decision === SamplingDecision.NOT_RECORD) {
        Logger.info(
          `[ExperimentalSpanFilterSampler] Dropping span because it does not match the filter function.`
        );
      }
      return { decision };
    } catch (error) {
      Logger.error(
        `[ExperimentalSpanFilterSampler] Error filtering span: ${error}`
      );
      return { decision: SamplingDecision.RECORD_AND_SAMPLED };
    }
  }
}
