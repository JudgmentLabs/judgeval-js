import type { OpenAI } from "openai";
import {
  wrapAnthropicManagedAgents,
  type ManagedAgentsClientLike,
} from "./llm/anthropic-managed-agents";
import { wrapOpenAI } from "./llm/openai";

export { wrapAnthropicManagedAgents, wrapOpenAI };

function isManagedAgentsClient(
  client: unknown,
): client is ManagedAgentsClientLike {
  const stream = (client as Partial<ManagedAgentsClientLike> | undefined)?.beta
    ?.sessions?.events?.stream;
  return typeof stream === "function";
}

/**
 * Wrap a supported LLM client to add automatic tracing.
 *
 * @param client - An OpenAI or Anthropic client instance.
 * @returns The same client instance, instrumented in-place.
 *
 * @example
 * ```typescript
 * import OpenAI from "openai";
 * import { wrap } from "judgeval";
 *
 * const client = wrap(new OpenAI());
 * ```
 */
export function wrap<T extends OpenAI>(client: T): T;
export function wrap<T extends ManagedAgentsClientLike>(client: T): T;
export function wrap(client: OpenAI | ManagedAgentsClientLike): unknown {
  return isManagedAgentsClient(client)
    ? wrapAnthropicManagedAgents(client)
    : wrapOpenAI(client);
}
