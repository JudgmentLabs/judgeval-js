import type { OpenAI } from "openai";
/**
 * Wrap `client.chat.completions.create` to produce Judgment spans.
 * Handles both streaming and non-streaming calls.
 */
export declare function wrapChatCompletionsCreate(client: OpenAI): void;
//# sourceMappingURL=chat-completions.d.ts.map