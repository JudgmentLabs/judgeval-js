import type { OpenAI } from "openai";
import type {
  Response,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";
import type { Stream } from "openai/streaming";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { safeStringify } from "../../../utils/serializer";
import { immutableWrapAsync, proxyAsyncIterable } from "../../../utils/wrappers";
import {
  recordSpanError,
  setResponsesTokenAttributes,
  startLLMSpan,
} from "./utils";

/**
 * Wrap `client.responses.create` to produce Judgment spans.
 * Handles both streaming and non-streaming calls.
 */
export function wrapResponsesCreate(client: OpenAI): void {
  client.responses.create = immutableWrapAsync(
    client.responses.create.bind(client.responses),
    {
      pre: (body) => ({
        span: startLLMSpan("OPENAI_API_CALL", body.model, body),
        proxied: false,
      }),

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
                if (resp.usage) {
                  setResponsesTokenAttributes(span, resp.usage);
                }
                span.setAttribute(
                  AttributeKeys.JUDGMENT_LLM_MODEL_NAME,
                  resp.model,
                );
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
        const resp = result as Response;
        span.setAttribute(AttributeKeys.GEN_AI_COMPLETION, safeStringify(resp));
        if (resp.usage) {
          setResponsesTokenAttributes(span, resp.usage);
        }
        if (typeof resp.model === "string") {
          span.setAttribute(AttributeKeys.JUDGMENT_LLM_MODEL_NAME, resp.model);
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
