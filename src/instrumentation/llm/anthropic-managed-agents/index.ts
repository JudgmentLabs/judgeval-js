import { dontThrow } from "../../../utils/dont-throw";
import { immutableWrapAsync } from "../../../utils/wrappers";
import { exportTurn } from "./export-turn";
import { proxyTurns } from "./stream";
import type { ManagedAgentsApi, ManagedAgentsClientLike } from "./types";

export type { ManagedAgentsClientLike } from "./types";

/**
 * Instrument an Anthropic client so Claude Managed Agents sessions are traced.
 *
 * The agent loop runs on Anthropic's infrastructure, so there is no model call
 * to wrap. Instead this patches `client.beta.sessions.events.stream` to observe
 * the event stream your app already reads; events reach your code unchanged.
 * When a turn ends (the session goes idle, other than to wait for a tool result
 * or confirmation) one trace is exported:
 *
 * ```
 * invocation
 * ├─ invoke_agent <agent>
 * │  ├─ generate_content <model>        one per model request, with token usage
 * │  ├─ execute_tool <tool>             built-in, MCP and custom tools
 * │  └─ execute_tool transfer_to_agent  delegation to a sub-agent
 * └─ invoke_agent <sub-agent>
 * ```
 *
 * Spans nest under the active span, if any, and carry the session id set with
 * `Tracer.setSessionId()`, or else the Managed Agents session id. Only session
 * streams are traced, not `messages.create` or other Anthropic calls.
 *
 * Call this once per client.
 *
 * @param client - An Anthropic client instance (e.g. `new Anthropic()`).
 * @returns The same client instance (mutated).
 *
 * @example
 * ```typescript
 * import Anthropic from "@anthropic-ai/sdk";
 * import { Tracer, wrapAnthropicManagedAgents } from "judgeval";
 *
 * await Tracer.init({ projectName: "my-project" });
 * const client = wrapAnthropicManagedAgents(new Anthropic());
 *
 * const stream = await client.beta.sessions.events.stream(session.id);
 * await client.beta.sessions.events.send(session.id, { events: [...] });
 * for await (const event of stream) {
 *   if (event.type === "session.status_idle") break;
 * }
 * await Tracer.forceFlush();
 * ```
 */
export function wrapAnthropicManagedAgents<T extends ManagedAgentsClientLike>(
  client: T,
): T {
  dontThrow("wrapAnthropicManagedAgents", () => {
    const api = client as unknown as ManagedAgentsApi;
    const { events } = api.beta.sessions;
    events.stream = immutableWrapAsync(events.stream.bind(events), {
      post: (_ctx, stream, [sessionId]) => {
        proxyTurns(stream, (turn) => exportTurn(api, sessionId, turn));
      },
    });
  });
  return client;
}
