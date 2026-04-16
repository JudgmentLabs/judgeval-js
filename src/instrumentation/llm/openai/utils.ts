import type { Span } from "@opentelemetry/api";
import { SpanStatusCode } from "@opentelemetry/api";
import type { CompletionUsage } from "openai/resources/completions";
import type { ResponseUsage } from "openai/resources/responses/responses";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { BaseTracer } from "../../../trace/BaseTracer";
import { dontThrow } from "../../../utils/dont-throw";
import { safeStringify } from "../../../utils/serializer";

// ------------------------------------------------------------------ //
//  Token normalization                                                //
// ------------------------------------------------------------------ //

/**
 * Normalize OpenAI token counts.
 *
 * OpenAI may or may not pre-subtract cached tokens from prompt_tokens.
 * If the manual sum exceeds total_tokens, cached tokens were NOT
 * pre-subtracted so we do it ourselves.
 */
function normalizeAndSetTokens(
  span: Span,
  usage: unknown,
  opts: {
    promptTokens: number;
    completionTokens: number;
    cacheRead: number;
    cacheCreation: number;
    inputImageTokens: number;
    outputImageTokens: number;
    totalTokens: number;
  },
): void {
  const {
    promptTokens,
    completionTokens,
    cacheRead,
    cacheCreation,
    inputImageTokens,
    outputImageTokens,
    totalTokens,
  } = opts;

  const manualSum =
    promptTokens +
    completionTokens +
    cacheRead +
    cacheCreation +
    inputImageTokens +
    outputImageTokens;

  const nonCachedInput =
    manualSum > totalTokens ? promptTokens - cacheRead : promptTokens;

  setCostAttribute(span, usage);

  span.setAttribute(
    AttributeKeys.JUDGMENT_USAGE_NON_CACHED_INPUT_TOKENS,
    nonCachedInput,
  );
  if (completionTokens) {
    span.setAttribute(
      AttributeKeys.JUDGMENT_USAGE_OUTPUT_TOKENS,
      completionTokens,
    );
  }
  if (cacheRead) {
    span.setAttribute(
      AttributeKeys.JUDGMENT_USAGE_CACHE_READ_INPUT_TOKENS,
      cacheRead,
    );
  }
  if (cacheCreation) {
    span.setAttribute(
      AttributeKeys.JUDGMENT_USAGE_CACHE_CREATION_INPUT_TOKENS,
      cacheCreation,
    );
  }
  if (inputImageTokens) {
    span.setAttribute(
      AttributeKeys.JUDGMENT_USAGE_NON_CACHED_INPUT_IMAGE_TOKENS,
      inputImageTokens,
    );
  }
  if (outputImageTokens) {
    span.setAttribute(
      AttributeKeys.JUDGMENT_USAGE_OUTPUT_IMAGE_TOKENS,
      outputImageTokens,
    );
  }
  span.setAttribute(AttributeKeys.JUDGMENT_USAGE_METADATA, safeStringify(usage));
}

// ------------------------------------------------------------------ //
//  Cost extraction                                                   //
// ------------------------------------------------------------------ //

/**
 * Extract and set cost from usage data (OpenRouter `.cost` or BYOK
 * `.cost_details.upstream_inference_cost`).
 */
function setCostAttribute(span: Span, usage: unknown): void {
  const u = usage as Record<string, unknown>;
  if (u.cost != null && u.cost !== 0) {
    span.setAttribute(
      AttributeKeys.JUDGMENT_USAGE_TOTAL_COST_USD,
      Number(u.cost),
    );
    return;
  }
  if (typeof u.cost_details === "object" && u.cost_details != null) {
    const d = u.cost_details as Record<string, unknown>;
    if (
      d.upstream_inference_cost != null &&
      d.upstream_inference_cost !== 0
    ) {
      span.setAttribute(
        AttributeKeys.JUDGMENT_USAGE_TOTAL_COST_USD,
        Number(d.upstream_inference_cost),
      );
    }
  }
}

// ------------------------------------------------------------------ //
//  Shared span helpers                                               //
// ------------------------------------------------------------------ //

export function startLLMSpan(
  spanName: string,
  model: string | undefined,
  prompt: unknown,
): Span {
  const span = BaseTracer.startSpan(spanName, {
    [AttributeKeys.JUDGMENT_SPAN_KIND]: "llm",
  });
  if (model) {
    span.setAttribute(AttributeKeys.JUDGMENT_LLM_MODEL_NAME, model);
  }
  span.setAttribute(AttributeKeys.GEN_AI_PROMPT, safeStringify(prompt));
  return span;
}

export function recordSpanError(span: Span, error: unknown): void {
  span.recordException(error as Error);
  span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
}

// ------------------------------------------------------------------ //
//  Per-API token attribute setters                                   //
// ------------------------------------------------------------------ //

export function setChatTokenAttributes(
  span: Span,
  usage: CompletionUsage,
): void {
  dontThrow("setChatTokenAttributes", () => {
    normalizeAndSetTokens(span, usage, {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      cacheRead: usage.prompt_tokens_details?.cached_tokens ?? 0,
      cacheCreation: 0,
      inputImageTokens: 0,
      outputImageTokens: 0,
      totalTokens: usage.total_tokens,
    });
  });
}

export function setResponsesTokenAttributes(
  span: Span,
  usage: ResponseUsage,
): void {
  dontThrow("setResponsesTokenAttributes", () => {
    normalizeAndSetTokens(span, usage, {
      promptTokens: usage.input_tokens,
      completionTokens: usage.output_tokens,
      cacheRead: usage.input_tokens_details.cached_tokens,
      cacheCreation: 0,
      inputImageTokens: 0,
      outputImageTokens: 0,
      totalTokens: usage.total_tokens,
    });
  });
}

export function setImageTokenAttributes(span: Span, usage: unknown): void {
  dontThrow("setImageTokenAttributes", () => {
    const u = usage as Record<string, unknown>;
    const inputDetails = u.input_tokens_details as
      | Record<string, unknown>
      | undefined;

    normalizeAndSetTokens(span, usage, {
      promptTokens: Number(inputDetails?.text_tokens ?? 0),
      completionTokens: 0,
      cacheRead: 0,
      cacheCreation: 0,
      inputImageTokens: Number(inputDetails?.image_tokens ?? 0),
      outputImageTokens: Number(u.output_tokens ?? 0),
      totalTokens: Number(u.total_tokens ?? 0),
    });
  });
}
