import type { OpenAI } from "openai";
/**
 * Wrap `client.responses.create` to produce Judgment spans.
 * Handles both streaming and non-streaming calls.
 */
export declare function wrapResponsesCreate(client: OpenAI): void;
//# sourceMappingURL=responses.d.ts.map