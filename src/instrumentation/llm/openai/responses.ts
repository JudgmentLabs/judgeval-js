import type { Span } from "@opentelemetry/api";
import type { OpenAI } from "openai";
import type {
  Response,
  ResponseStreamEvent,
  ResponseUsage,
} from "openai/resources/responses/responses";
import type { Stream } from "openai/streaming";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { BaseTracer } from "../../../trace/BaseTracer";
import { dontThrow } from "../../../utils/dont-throw";
import { safeStringify } from "../../../utils/serializer";
import {
  immutableWrapAsync,
  proxyAsyncIterable,
} from "../../../utils/wrappers";

function recordUsage(span: Span, usage: ResponseUsage): void {
  dontThrow("responses.recordUsage", () => {
    const cacheRead = usage.input_tokens_details.cached_tokens;
    const sum = usage.input_tokens + usage.output_tokens + cacheRead;
    BaseTracer.recordLLMMetadata(
      {
        non_cached_input_tokens:
          sum > usage.total_tokens
            ? usage.input_tokens - cacheRead
            : usage.input_tokens,
        output_tokens: usage.output_tokens || undefined,
        cache_read_input_tokens: cacheRead || undefined,
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
 * Wrap `client.responses.create` to produce Judgment spans.
 * Handles both streaming and non-streaming calls.
 */
export function wrapResponsesCreate(client: OpenAI): void {
  client.responses.create = immutableWrapAsync(
    client.responses.create.bind(client.responses),
    {
      pre: (body) => {
        const span = BaseTracer.startSpan("OPENAI_API_CALL");
        BaseTracer.setSpanKind("llm", span);
        BaseTracer.recordLLMMetadata({ model: body.model }, span);
        BaseTracer.setInput(body, span);
        return { span, proxied: false };
      },

      post: (ctx, result, args) => {
        if (!ctx) return;
        const { span } = ctx;

        if (args[0].stream) {
          const stream = result as Stream<ResponseStreamEvent>;
          let accumulatedContent = "";

          proxyAsyncIterable(stream, {
            onYield(chunk) {
              if (chunk.type === "response.output_text.delta") {
                accumulatedContent += chunk.delta;
              }
              if (chunk.type === "response.completed") {
                const resp = chunk.response;
                if (resp.usage) recordUsage(span, resp.usage);
                BaseTracer.recordLLMMetadata({ model: resp.model }, span);
              }
            },
            onDone() {
              BaseTracer.setOutput(accumulatedContent, span);
            },
            onError(err) {
              BaseTracer.setError(err, span);
            },
            onFinally() {
              span.end();
            },
          });

          return { span, proxied: true };
        }

        // Non-streaming
        const resp = result as Response;
        BaseTracer.setOutput(safeStringify(resp), span);
        if (resp.usage) recordUsage(span, resp.usage);
        if (typeof resp.model === "string") {
          BaseTracer.recordLLMMetadata({ model: resp.model }, span);
        }
        return ctx;
      },

      error: (ctx, err) => {
        if (ctx) BaseTracer.setError(err, ctx.span);
        return ctx;
      },

      finally: (ctx) => {
        if (ctx && !ctx.proxied) ctx.span.end();
      },
    },
  );
}
