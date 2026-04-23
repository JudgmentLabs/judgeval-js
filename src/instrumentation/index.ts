import type { Anthropic } from "@anthropic-ai/sdk";
import type { OpenAI } from "openai";
import { wrapAnthropic } from "./llm/anthropic";
import { wrapOpenAI } from "./llm/openai";

export { wrapAnthropic, wrapOpenAI };

/**
 * Wrap a supported LLM client to add automatic tracing.
 *
 * Supports OpenAI and Anthropic clients. Detects the client type
 * automatically and applies the appropriate instrumentation.
 *
 * @param client - An OpenAI or Anthropic client instance.
 * @returns The same client instance, instrumented in-place.
 *
 * @example
 * ```typescript
 * import OpenAI from "openai";
 * import Anthropic from "@anthropic-ai/sdk";
 * import { wrap } from "judgeval";
 *
 * const openai = wrap(new OpenAI());
 * const anthropic = wrap(new Anthropic());
 * ```
 */
export function wrap<T extends OpenAI | Anthropic>(client: T): T {
  // OpenAI has `chat` and `responses` at the top level; Anthropic does not.
  if ("chat" in client && "responses" in client) {
    return wrapOpenAI(client as T & OpenAI) as T;
  }
  return wrapAnthropic(client as T & Anthropic) as T;
}
