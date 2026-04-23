import type { Anthropic } from "@anthropic-ai/sdk";
import type {
  Message,
  RawMessageStreamEvent,
} from "@anthropic-ai/sdk/resources/messages/messages";
import type { Stream } from "@anthropic-ai/sdk/streaming";
import { BaseTracer } from "../../../trace/BaseTracer";
import { safeStringify } from "../../../utils/serializer";
import {
  immutableWrapAsync,
  proxyAsyncIterable,
} from "../../../utils/wrappers";
import { recordAnthropicStreamingUsage, recordAnthropicUsage } from "./utils";

/**
 * Wrap `client.messages.create` to produce Judgment spans.
 * Handles both streaming and non-streaming calls.
 */
export function wrapMessagesCreate(client: Anthropic): void {
  client.messages.create = immutableWrapAsync(
    client.messages.create.bind(client.messages),
    {
      pre: (body) => {
        const span = BaseTracer.startSpan("ANTHROPIC_API_CALL");
        BaseTracer.setSpanKind("llm", span);
        BaseTracer.recordLLMMetadata(
          { model: body.model, provider: "anthropic" },
          span,
        );
        BaseTracer.setInput(body, span);
        return { span, proxied: false };
      },

      post: (ctx, result, args) => {
        if (!ctx) return;
        const { span } = ctx;

        if (args[0].stream) {
          const stream = result as Stream<RawMessageStreamEvent>;
          let accumulatedContent = "";

          proxyAsyncIterable(stream, {
            onYield(chunk) {
              if (
                chunk.type === "content_block_delta" &&
                chunk.delta.type === "text_delta"
              ) {
                accumulatedContent += chunk.delta.text;
              }
              if (chunk.type === "message_delta") {
                recordAnthropicStreamingUsage(span, chunk.usage);
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
        const message = result as Message;
        BaseTracer.setOutput(safeStringify(message), span);
        if (message.usage) recordAnthropicUsage(span, message.usage);
        BaseTracer.recordLLMMetadata({ model: message.model }, span);
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
