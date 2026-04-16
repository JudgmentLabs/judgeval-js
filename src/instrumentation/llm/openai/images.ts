import type { OpenAI } from "openai";
import type {
  ImageGenCompletedEvent,
  ImageGenStreamEvent,
  ImagesResponse,
} from "openai/resources/images";
import type { Stream } from "openai/streaming";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { Tracer } from "../../../trace/Tracer";
import { dontThrow } from "../../../utils/dont-throw";
import { safeStringify } from "../../../utils/serializer";
import {
  immutableWrapAsync,
  proxyAsyncIterable,
} from "../../../utils/wrappers";

const IMAGE_COMPLETED_TYPES = new Set([
  "image_generation.completed",
  "image_edit.completed",
]);

type ImageUsage = ImageGenCompletedEvent.Usage | ImagesResponse.Usage;

function recordUsage(
  span: import("@opentelemetry/api").Span,
  usage: ImageUsage,
): void {
  dontThrow("images.recordUsage", () => {
    const inputDetails =
      "input_tokens_details" in usage ? usage.input_tokens_details : undefined;
    const imageInputTokens = inputDetails?.image_tokens ?? 0;

    Tracer.recordLLMMetadata(
      {
        non_cached_input_tokens: inputDetails?.text_tokens ?? 0,
        output_tokens: usage.output_tokens || undefined,
      },
      span,
    );

    if (imageInputTokens) {
      Tracer.setAttribute(
        AttributeKeys.JUDGMENT_USAGE_NON_CACHED_INPUT_IMAGE_TOKENS,
        imageInputTokens,
        span,
      );
    }
    if (usage.output_tokens) {
      Tracer.setAttribute(
        AttributeKeys.JUDGMENT_USAGE_OUTPUT_IMAGE_TOKENS,
        usage.output_tokens,
        span,
      );
    }
    Tracer.setAttribute(
      AttributeKeys.JUDGMENT_USAGE_METADATA,
      safeStringify(usage),
      span,
    );
  });
}

/**
 * Wrap `client.images.generate` to produce Judgment spans.
 * Handles both streaming and non-streaming calls.
 */
export function wrapImagesGenerate(client: OpenAI): void {
  client.images.generate = immutableWrapAsync(
    client.images.generate.bind(client.images),
    {
      pre: (body) => {
        const span = Tracer.startSpan("OPENAI_API_CALL");
        Tracer.setSpanKind("llm", span);
        Tracer.recordLLMMetadata(
          { model: body.model as string | undefined },
          span,
        );
        Tracer.setInput(body, span);
        return { span, proxied: false };
      },

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
                recordUsage(span, completionData.usage);
              }
            },
            onDone() {
              Tracer.setOutput(safeStringify(completionData ?? {}), span);
            },
            onError(err) {
              Tracer.setError(err, span);
            },
            onFinally() {
              span.end();
            },
          });

          return { span, proxied: true };
        }

        // Non-streaming
        const imgResult = result as ImagesResponse;
        Tracer.setOutput(safeStringify(imgResult), span);
        if (imgResult.usage) recordUsage(span, imgResult.usage);
        return ctx;
      },

      error: (ctx, err) => {
        if (ctx) Tracer.setError(err, ctx.span);
        return ctx;
      },

      finally: (ctx) => {
        if (ctx && !ctx.proxied) ctx.span.end();
      },
    },
  );
}
