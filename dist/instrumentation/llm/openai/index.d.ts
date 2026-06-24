import type { OpenAI } from "openai";
/**
 * Instrument an OpenAI client instance to emit Judgment spans.
 *
 * Patches the following methods in-place:
 *  - `client.chat.completions.create` (streaming + non-streaming)
 *  - `client.chat.completions.parse` (non-streaming)
 *  - `client.responses.create` (streaming + non-streaming)
 *  - `client.images.generate` (streaming + non-streaming)
 *
 * @returns The same client instance (mutated).
 */
export declare function wrapOpenAI<T extends OpenAI>(client: T): T;
//# sourceMappingURL=index.d.ts.map