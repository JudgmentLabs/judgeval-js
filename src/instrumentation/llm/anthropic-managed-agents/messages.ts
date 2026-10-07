import type {
  BetaManagedAgentsDocumentBlock,
  BetaManagedAgentsImageBlock,
  BetaManagedAgentsRedactedBlock,
  BetaManagedAgentsSearchResultBlock,
  BetaManagedAgentsStreamSessionEvents as SessionEvent,
  BetaManagedAgentsTextBlock,
} from "@anthropic-ai/sdk/resources/beta/sessions/events";

type Content = (
  | BetaManagedAgentsTextBlock
  | BetaManagedAgentsImageBlock
  | BetaManagedAgentsDocumentBlock
  | BetaManagedAgentsRedactedBlock
  | BetaManagedAgentsSearchResultBlock
)[];

interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

interface ToolResult {
  callId: string;
  output: string;
  isError: boolean;
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export function timeOf(event: SessionEvent): Date {
  return "processed_at" in event && event.processed_at
    ? new Date(event.processed_at)
    : new Date();
}

export function textOf(content: Content | undefined): string {
  return (content ?? [])
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
}

/** A tool call, or a message to a sub-agent, which is shown as a tool call. */
export function toCall(event: SessionEvent): ToolCall | undefined {
  switch (event.type) {
    case "agent.tool_use":
    case "agent.mcp_tool_use":
    case "agent.custom_tool_use":
      return { id: event.id, name: event.name, input: event.input };
    case "agent.thread_message_sent":
      return {
        id: event.to_session_thread_id,
        name: "transfer_to_agent",
        input: {
          agent_name: event.to_agent_name,
          message: textOf(event.content),
        },
      };
    default:
      return undefined;
  }
}

export function toResult(event: SessionEvent): ToolResult | undefined {
  switch (event.type) {
    case "agent.tool_result":
      return result(event.tool_use_id, event.content, event.is_error);
    case "agent.mcp_tool_result":
      return result(event.mcp_tool_use_id, event.content, event.is_error);
    case "user.custom_tool_result":
      return result(event.custom_tool_use_id, event.content, event.is_error);
    case "agent.thread_message_received":
      return result(event.from_session_thread_id, event.content);
    default:
      return undefined;
  }
}

function result(
  callId: string,
  content: Content | undefined,
  isError?: boolean | null,
): ToolResult {
  return { callId, output: textOf(content), isError: isError === true };
}

/** Whether the model produced the event in response to a request. */
export function isModelOutput(event: SessionEvent): boolean {
  return event.type === "agent.message" || toCall(event) !== undefined;
}

export function toMessages(events: SessionEvent[]): Message[] {
  return events.flatMap((event): Message[] => {
    const call = toCall(event);
    if (call) return [{ role: "assistant", tool_calls: [call] }];
    const result = toResult(event);
    if (result) {
      return [
        { role: "tool", tool_call_id: result.callId, content: result.output },
      ];
    }
    switch (event.type) {
      case "user.message":
        return [{ role: "user", content: textOf(event.content) }];
      case "agent.message":
        return [{ role: "assistant", content: textOf(event.content) }];
      default:
        return [];
    }
  });
}
