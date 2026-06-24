import type { OpenAI } from "openai";
/**
 * Wrap `client.chat.completions.parse` to produce Judgment spans.
 * Non-streaming only — parse does not support streaming.
 */
export declare function wrapChatCompletionsParse(client: OpenAI): void;
//# sourceMappingURL=beta-chat-completions.d.ts.map