import type { OpenAI } from "openai";
import { dontThrow } from "../../../utils/dont-throw";
import { wrapChatCompletionsParse } from "./beta-chat-completions";
import { wrapChatCompletionsCreate } from "./chat-completions";
import { wrapImagesGenerate } from "./images";
import { wrapResponsesCreate } from "./responses";

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
export function wrapOpenAI<T extends OpenAI>(client: T): T {
  dontThrow("wrapOpenAI", () => {
    wrapChatCompletionsCreate(client);
    wrapChatCompletionsParse(client);
    wrapResponsesCreate(client);
    wrapImagesGenerate(client);
  });
  return client;
}
