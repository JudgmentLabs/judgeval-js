import type { Anthropic } from "@anthropic-ai/sdk";
import { dontThrow } from "../../../utils/dont-throw";
import { wrapEventsStream } from "./events-stream";

/**
 * Instrument an Anthropic client to send Claude Managed Agents sessions to
 * Judgment. Call it on the client you use to stream the session's events.
 *
 * Each turn of a session becomes an `invoke_agent` span with a
 * `generate_content` span per model request (model, token usage and cost) and
 * an `execute_tool` span per tool call. A coordinator's transfer to a
 * sub-agent is an `execute_tool transfer_to_agent` span with the sub-agent's
 * own run nested beneath it.
 *
 * Spans carry the Managed Agents session ID as their Judgment session ID,
 * unless the active trace already has one set with `Tracer.setSessionId`.
 *
 * Patches `client.beta.sessions.events.stream` in place.
 *
 * @returns The same client instance (mutated).
 */
export function wrapAnthropicManagedAgents<T extends Anthropic>(client: T): T {
  dontThrow("wrapAnthropicManagedAgents", () => {
    wrapEventsStream(client);
  });
  return client;
}
