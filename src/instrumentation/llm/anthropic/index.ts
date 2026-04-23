import type { Anthropic } from "@anthropic-ai/sdk";
import { dontThrow } from "../../../utils/dont-throw";
import { wrapMessagesCreate } from "./messages";

/**
 * Instrument an Anthropic client instance to emit Judgment spans.
 *
 * Patches the following methods in-place:
 *  - `client.messages.create` (streaming + non-streaming)
 *
 * @returns The same client instance (mutated).
 */
export function wrapAnthropic<T extends Anthropic>(client: T): T {
  dontThrow("wrapAnthropic", () => {
    wrapMessagesCreate(client);
  });
  return client;
}
