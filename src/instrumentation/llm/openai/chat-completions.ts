import type { OpenAI } from "openai";
import type {
  ChatCompletion,
  ChatCompletionChunk,
} from "openai/resources/chat/completions/completions";
import type { Stream } from "openai/streaming";
import { BaseTracer } from "../../../trace/BaseTracer";
import { safeStringify } from "../../../utils/serializer";
import {
  immutableWrapAsync,
  proxyAsyncIterable,
} from "../../../utils/wrappers";
import { recordChatUsage } from "./utils";

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
          const stream = result as Stream<ChatCompletionChunk>;
          let accumulatedContent = "";

          proxyAsyncIterable(stream, {
            onYield(chunk) {
              if (typeof chunk.choices[0]?.delta.content === "string") {
                accumulatedContent += chunk.choices[0].delta.content;
              }
              if (chunk.usage) recordChatUsage(span, chunk.usage);
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
        const completion = result as ChatCompletion;
        BaseTracer.setOutput(safeStringify(completion), span);
        if (completion.usage) recordChatUsage(span, completion.usage);
        BaseTracer.recordLLMMetadata({ model: completion.model }, span);
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
