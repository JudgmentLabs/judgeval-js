import type { Span } from "@opentelemetry/api";
import type {
  MessageDeltaUsage,
  Usage,
} from "@anthropic-ai/sdk/resources/messages/messages";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { BaseTracer } from "../../../trace/BaseTracer";
import { dontThrow } from "../../../utils/dont-throw";
import { safeStringify } from "../../../utils/serializer";

/**
 * Record usage from a non-streaming `Message.usage` object.
 */
export function recordAnthropicUsage(span: Span, usage: Usage): void {
  dontThrow("recordAnthropicUsage", () => {
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const cacheCreation = usage.cache_creation_input_tokens ?? 0;
    BaseTracer.recordLLMMetadata(
      {
        non_cached_input_tokens: usage.input_tokens || undefined,
        output_tokens: usage.output_tokens || undefined,
        cache_read_input_tokens: cacheRead || undefined,
        cache_creation_input_tokens: cacheCreation || undefined,
      },
      span,
    );
    BaseTracer.setAttribute(
      AttributeKeys.JUDGMENT_USAGE_METADATA,
      safeStringify(usage),
      span,
    );
  });
}

/**
 * Record usage from a streaming `message_delta` event's cumulative usage.
 */
export function recordAnthropicStreamingUsage(
  span: Span,
  usage: MessageDeltaUsage,
): void {
  dontThrow("recordAnthropicStreamingUsage", () => {
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const cacheCreation = usage.cache_creation_input_tokens ?? 0;
    const inputTokens = usage.input_tokens ?? 0;
    BaseTracer.recordLLMMetadata(
      {
        non_cached_input_tokens: inputTokens || undefined,
        output_tokens: usage.output_tokens || undefined,
        cache_read_input_tokens: cacheRead || undefined,
        cache_creation_input_tokens: cacheCreation || undefined,
      },
      span,
    );
    BaseTracer.setAttribute(
      AttributeKeys.JUDGMENT_USAGE_METADATA,
      safeStringify(usage),
      span,
    );
  });
}
