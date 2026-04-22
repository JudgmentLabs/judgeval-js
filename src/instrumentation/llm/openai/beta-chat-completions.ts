import type { OpenAI } from "openai";
import { BaseTracer } from "../../../trace/BaseTracer";
import { safeStringify } from "../../../utils/serializer";
import { immutableWrapAsync } from "../../../utils/wrappers";
import { recordChatUsage } from "./utils";

/**
 * Wrap `client.chat.completions.parse` to produce Judgment spans.
 * Non-streaming only — parse does not support streaming.
 */
export function wrapChatCompletionsParse(client: OpenAI): void {
  client.chat.completions.parse = immutableWrapAsync(
    client.chat.completions.parse.bind(client.chat.completions),
    {
      pre: (body) => {
        const span = BaseTracer.startSpan("OPENAI_API_CALL");
        BaseTracer.setSpanKind("llm", span);
        BaseTracer.recordLLMMetadata({ model: body.model }, span);
        BaseTracer.setInput(body, span);
        return span;
      },

      post: (span, result) => {
        if (!span) return;
        BaseTracer.setOutput(safeStringify(result), span);
        if (result.usage) recordChatUsage(span, result.usage);
        BaseTracer.recordLLMMetadata({ model: result.model }, span);
        return span;
      },

      error: (span, err) => {
        if (span) BaseTracer.setError(err, span);
        return span;
      },

      finally: (span) => {
        span?.end();
      },
    },
  );
}
