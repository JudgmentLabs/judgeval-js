import type { Span } from "@opentelemetry/api";
import type { CompletionUsage } from "openai/resources/completions";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { Tracer } from "../../../trace/Tracer";
import { dontThrow } from "../../../utils/dont-throw";
import { safeStringify } from "../../../utils/serializer";

export function recordChatUsage(span: Span, usage: CompletionUsage): void {
  dontThrow("recordChatUsage", () => {
    const cacheRead = usage.prompt_tokens_details?.cached_tokens ?? 0;
    const sum = usage.prompt_tokens + usage.completion_tokens + cacheRead;
    Tracer.recordLLMMetadata(
      {
        non_cached_input_tokens:
          sum > usage.total_tokens
            ? usage.prompt_tokens - cacheRead
            : usage.prompt_tokens,
        output_tokens: usage.completion_tokens || undefined,
        cache_read_input_tokens: cacheRead || undefined,
      },
      span,
    );
    Tracer.setAttribute(
      AttributeKeys.JUDGMENT_USAGE_METADATA,
      safeStringify(usage),
      span,
    );
  });
}
