import type { OpenAI } from "openai";
import type {
  ChatCompletion,
  ChatCompletionChunk,
} from "openai/resources/chat/completions/completions";
import type { Stream } from "openai/streaming";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { safeStringify } from "../../../utils/serializer";
import { immutableWrapAsync, proxyAsyncIterable } from "../../../utils/wrappers";
import {
  recordSpanError,
  setChatTokenAttributes,
  startLLMSpan,
} from "./utils";

/**
 * Wrap `client.chat.completions.create` to produce Judgment spans.
 * Handles both streaming and non-streaming calls.
 */
export function wrapChatCompletionsCreate(client: OpenAI): void {
  client.chat.completions.create = immutableWrapAsync(
    client.chat.completions.create.bind(client.chat.completions),
    {
      pre: (body) => {
        if (body.stream) body.stream_options ??= { include_usage: true };
        return {
          span: startLLMSpan("OPENAI_API_CALL", body.model, body),
          proxied: false,
        };
      },

      post: (ctx, result, args) => {
        if (!ctx) return;
        const { span } = ctx;

        if (args[0].stream) {
          const stream = result as Stream<ChatCompletionChunk>;
          let accumulatedContent = "";

          proxyAsyncIterable(stream, {
            onYield(chunk) {
              if (typeof chunk.choices[0]?.delta.content === "string") {
                accumulatedContent += chunk.choices[0].delta.content;
              }
              if (chunk.usage) {
                setChatTokenAttributes(span, chunk.usage);
              }
            },
            onDone() {
              span.setAttribute(
                AttributeKeys.GEN_AI_COMPLETION,
                accumulatedContent,
              );
            },
            onError(err) {
              recordSpanError(span, err);
            },
            onFinally() {
              span.end();
            },
          });

          return { span, proxied: true };
        }

        // Non-streaming
        const completion = result as ChatCompletion;
        span.setAttribute(
          AttributeKeys.GEN_AI_COMPLETION,
          safeStringify(completion),
        );
        if (completion.usage) {
          setChatTokenAttributes(span, completion.usage);
        }
        span.setAttribute(
          AttributeKeys.JUDGMENT_LLM_MODEL_NAME,
          completion.model,
        );
        return ctx;
      },

      error: (ctx, err) => {
        if (ctx) recordSpanError(ctx.span, err);
        return ctx;
      },

      finally: (ctx) => {
        if (ctx && !ctx.proxied) ctx.span.end();
      },
    },
  );
}
