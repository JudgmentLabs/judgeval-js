import type { OpenAI } from "openai";
import { Tracer } from "../../../trace/Tracer";
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
        const span = Tracer.startSpan("OPENAI_API_CALL");
        Tracer.setSpanKind("llm", span);
        Tracer.recordLLMMetadata({ model: body.model }, span);
        Tracer.setInput(body, span);
        return span;
      },

      post: (span, result) => {
        if (!span) return;
        Tracer.setOutput(safeStringify(result), span);
        if (result.usage) recordChatUsage(span, result.usage);
        Tracer.recordLLMMetadata({ model: result.model }, span);
        return span;
      },

      error: (span, err) => {
        if (span) Tracer.setError(err, span);
        return span;
      },

      finally: (span) => {
        span?.end();
      },
    },
  );
}
