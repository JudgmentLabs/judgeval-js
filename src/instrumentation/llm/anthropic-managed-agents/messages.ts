import { textOf, toolUseIdOf } from "./events";
import type { SessionEvent } from "./types";

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: { id?: string; name?: string; input: unknown }[];
}

/**
 * The chat messages that `events` stand for. A sub-agent receives its
 * coordinator's message as a user message and replies with an assistant
 * message. The coordinator sees the same exchange as a `transfer_to_agent`
 * tool call and its result.
 */
export function toMessages(
  events: SessionEvent[],
  isSubAgent: boolean,
): Message[] {
  return events.flatMap((event) => toMessage(event, isSubAgent) ?? []);
}

function toMessage(
  event: SessionEvent,
  isSubAgent: boolean,
): Message | undefined {
  const content = textOf(event.content);
  switch (event.type) {
    case "user.message":
      return { role: "user", content };
    case "agent.message":
      return { role: "assistant", content };
    case "agent.tool_use":
    case "agent.mcp_tool_use":
    case "agent.custom_tool_use":
      return {
        role: "assistant",
        tool_calls: [{ id: event.id, name: event.name, input: event.input }],
      };
    case "agent.tool_result":
    case "agent.mcp_tool_result":
    case "user.custom_tool_result":
      return { role: "tool", tool_call_id: toolUseIdOf(event), content };
    case "agent.thread_message_received":
      return isSubAgent
        ? { role: "user", name: event.from_agent_name, content }
        : {
            role: "tool",
            name: "transfer_to_agent",
            tool_call_id: event.from_session_thread_id,
            content,
          };
    case "agent.thread_message_sent":
      return isSubAgent
        ? { role: "assistant", content }
        : {
            role: "assistant",
            tool_calls: [
              {
                id: event.to_session_thread_id,
                name: "transfer_to_agent",
                input: { agent_name: event.to_agent_name, message: content },
              },
            ],
          };
    default:
      return undefined;
  }
}
