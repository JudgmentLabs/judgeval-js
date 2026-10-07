import type { Anthropic } from "@anthropic-ai/sdk";
import { dontThrow } from "../../../utils/dont-throw";
import { wrapEventsStream } from "./events-stream";

/**
 * Instrument an Anthropic client instance to emit Judgment spans for
 * Managed Agents sessions.
 *
 * Patches the following methods in-place:
 *  - `client.beta.sessions.events.stream`
 *
 * @returns The same client instance (mutated).
 */
export function wrapAnthropicManagedAgents<T extends Anthropic>(client: T): T {
  dontThrow("wrapAnthropicManagedAgents", () => {
    wrapEventsStream(client);
  });
  return client;
}
