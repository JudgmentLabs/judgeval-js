import type { SessionEvent } from "./types";

const TOOL_USE_TYPES = [
  "agent.tool_use",
  "agent.mcp_tool_use",
  "agent.custom_tool_use",
];

export function timeOf(event: SessionEvent): number {
  return event.processed_at ? Date.parse(event.processed_at) : Date.now();
}

/** When the last of `events` happened. */
export function endOf(events: SessionEvent[]): number {
  return timeOf(events[events.length - 1]);
}

/** A filter for the events that happened between the first and last of `turn`. */
export function within(turn: SessionEvent[]): (event: SessionEvent) => boolean {
  const start = timeOf(turn[0]);
  const end = endOf(turn);
  return (event) => timeOf(event) >= start && timeOf(event) <= end;
}

export function textOf(content: SessionEvent["content"]): string {
  if (typeof content === "string") return content;
  return (content ?? []).map((block) => block.text ?? "").join("");
}

export function isToolUse(event: SessionEvent): boolean {
  return TOOL_USE_TYPES.includes(event.type);
}

/** Whether `event` is something the model produced in response to a request. */
export function isModelOutput(event: SessionEvent): boolean {
  return (
    event.type === "agent.message" ||
    event.type === "agent.thread_message_sent" ||
    isToolUse(event)
  );
}

/** The id of the tool call that `event` is the result of, if it is a result. */
export function toolUseIdOf(event: SessionEvent): string | undefined {
  switch (event.type) {
    case "agent.tool_result":
      return event.tool_use_id;
    case "agent.mcp_tool_result":
      return event.mcp_tool_use_id;
    case "user.custom_tool_result":
      return event.custom_tool_use_id;
    default:
      return undefined;
  }
}

/** The text of the last message the agent wrote. */
export function lastReplyOf(events: SessionEvent[]): string {
  const reply = events.filter((event) => event.type === "agent.message").pop();
  return reply ? textOf(reply.content) : "";
}

/** Why the session last went idle (for example `end_turn`). */
export function stopReasonOf(events: SessionEvent[]): string | undefined {
  return events.filter((event) => event.type === "session.status_idle").pop()
    ?.stop_reason?.type;
}

/**
 * A turn ends when the session goes idle, unless it is waiting for a tool
 * result or confirmation, and when the session terminates or is deleted.
 */
export function isTurnEnd(event: SessionEvent): boolean {
  switch (event.type) {
    case "session.status_idle":
      return event.stop_reason?.type !== "requires_action";
    case "session.status_terminated":
    case "session.deleted":
      return true;
    default:
      return false;
  }
}

/** Whether a user or an agent did anything, as opposed to only status changes. */
export function hasActivity(events: SessionEvent[]): boolean {
  return events.some(
    ({ type }) =>
      type.startsWith("user.") ||
      type.startsWith("agent.") ||
      type === "session.error",
  );
}
