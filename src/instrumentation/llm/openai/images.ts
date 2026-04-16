import type { OpenAI } from "openai";
import type {
  ImageGenCompletedEvent,
  ImageGenStreamEvent,
  ImagesResponse,
} from "openai/resources/images";
import type { Stream } from "openai/streaming";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { safeStringify } from "../../../utils/serializer";
import { immutableWrapAsync, proxyAsyncIterable } from "../../../utils/wrappers";
import {
  recordSpanError,
  setImageTokenAttributes,
  startLLMSpan,
} from "./utils";

const IMAGE_COMPLETED_TYPES = new Set([
  "image_generation.completed",
  "image_edit.completed",
]);

/**
 * Wrap `client.images.generate` to produce Judgment spans.
 * Handles both streaming and non-streaming calls.
 */
export function wrapImagesGenerate(client: OpenAI): void {
  client.images.generate = immutableWrapAsync(
    client.images.generate.bind(client.images),
    {
      pre: (body) => ({
        span: startLLMSpan(
          "OPENAI_API_CALL",
          body.model as string | undefined,
          body,
        ),
        proxied: false,
      }),

      post: (ctx, result, args) => {
        if (!ctx) return;
        const { span } = ctx;

        if (args[0].stream) {
          const stream = result as Stream<ImageGenStreamEvent>;
          let completionData: ImageGenCompletedEvent | undefined;

          proxyAsyncIterable(stream, {
            onYield(chunk) {
              if (IMAGE_COMPLETED_TYPES.has(chunk.type)) {
                completionData = chunk as ImageGenCompletedEvent;
                setImageTokenAttributes(span, completionData);
              }
            },
            onDone() {
              span.setAttribute(
                AttributeKeys.GEN_AI_COMPLETION,
                safeStringify(completionData ?? {}),
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
        const imgResult = result as ImagesResponse;
        span.setAttribute(
          AttributeKeys.GEN_AI_COMPLETION,
          safeStringify(imgResult),
        );
        if (imgResult.usage) {
          setImageTokenAttributes(span, imgResult.usage);
        }
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
