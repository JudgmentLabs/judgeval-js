import type { OpenAI } from "openai";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { safeStringify } from "../../../utils/serializer";
import { immutableWrapAsync } from "../../../utils/wrappers";
import { recordSpanError, setChatTokenAttributes, startLLMSpan } from "./utils";

/**
 * Wrap `client.chat.completions.parse` to produce Judgment spans.
 * Non-streaming only — parse does not support streaming.
 */
export function wrapChatCompletionsParse(client: OpenAI): void {
  client.chat.completions.parse = immutableWrapAsync(
    client.chat.completions.parse.bind(client.chat.completions),
    {
      pre: (body) => startLLMSpan("OPENAI_API_CALL", body.model, body),

      post: (span, result) => {
        if (!span) return;
        span.setAttribute(
          AttributeKeys.GEN_AI_COMPLETION,
          safeStringify(result),
        );
        if (result.usage) {
          setChatTokenAttributes(span, result.usage);
        }
        span.setAttribute(AttributeKeys.JUDGMENT_LLM_MODEL_NAME, result.model);
        return span;
      },

      error: (span, err) => {
        if (span) recordSpanError(span, err);
        return span;
      },

      finally: (span) => {
        span?.end();
      },
    },
  );
}
