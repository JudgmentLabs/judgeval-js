import type { OpenAI } from "openai";
import { setLLMWrapper } from "../trace/runtime";
import { wrapOpenAI } from "./llm/openai";

export { wrapOpenAI };

/**
 * Wrap a supported LLM client to add automatic tracing.
 *
 * Currently supports OpenAI clients. Detects the client type
 * automatically and applies the appropriate instrumentation.
 *
 * @param client - An OpenAI client instance.
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
export function wrap<T extends OpenAI>(client: T): T {
  return wrapOpenAI(client);
}

setLLMWrapper((client) => wrap(client as OpenAI));
