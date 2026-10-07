import type { BetaManagedAgentsStreamSessionEvents } from "@anthropic-ai/sdk/resources/beta/sessions/events";
import { BaseTracer } from "../../../trace/BaseTracer";
import { getTraceRuntime } from "../../../trace/runtime";

export type SessionEvent = BetaManagedAgentsStreamSessionEvents;

/** A turn ends when the session goes idle, unless it waits for a tool result. */
export function endsTurn(event: SessionEvent): boolean {
  switch (event.type) {
    case "session.status_idle":
      return event.stop_reason.type !== "requires_action";
    case "session.status_terminated":
    case "session.deleted":
      return true;
    default:
      return false;
  }
}

function timeOf(event: SessionEvent): Date {
  return "processed_at" in event && event.processed_at
    ? new Date(event.processed_at)
    : new Date();
}

/** Export a turn as one span: the user's events as input, the rest as output. */
export function exportTurn(turn: SessionEvent[]): void {
  if (!turn.some((event) => event.type.startsWith("agent."))) return;

  const span = BaseTracer.getOTELTracer().startSpan(
    "ANTHROPIC_MANAGED_AGENTS_TURN",
    { startTime: timeOf(turn[0]) },
    getTraceRuntime().getCurrentContext(),
  );
  BaseTracer.setSpanKind("agent", span);
  BaseTracer.setInput(
    turn.filter((event) => event.type.startsWith("user.")),
    span,
  );
  BaseTracer.setOutput(
    turn.filter((event) => !event.type.startsWith("user.")),
    span,
  );
  span.end(timeOf(turn[turn.length - 1]));
}
