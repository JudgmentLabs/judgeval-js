import type { Context } from "@opentelemetry/api";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { getBaggage } from "../../../trace/baggage";
import { getTraceRuntime } from "../../../trace/runtime";
import { Logger } from "../../../utils/logger";
import { loadAgents } from "./agents";
import { hasActivity } from "./events";
import { buildInvocation } from "./spans";
import type { ManagedAgentsApi, SessionEvent } from "./types";
import { writeSpans } from "./write";

/** A turn read from the stream, and where its spans belong. */
export interface StreamedTurn {
  events: SessionEvent[];
  /** True when the stream ended before the turn did. */
  incomplete: boolean;
  /** The context that was active when the stream started being read. */
  parent: Context;
}

/**
 * Export one turn as a trace. Never throws: a failure is logged and the
 * session continues untraced.
 */
export async function exportTurn(
  client: ManagedAgentsApi,
  sessionId: string,
  turn: StreamedTurn,
): Promise<void> {
  if (!hasActivity(turn.events) || !getTraceRuntime().getActiveTracer()) return;
  try {
    const agents = await loadAgents(client, sessionId, turn.events);
    const invocation = buildInvocation({
      sessionId,
      events: turn.events,
      agents,
      incomplete: turn.incomplete,
    });
    // Respect `Tracer.setSessionId()`, otherwise group by the Managed Agents session.
    const judgmentSessionId =
      getBaggage(turn.parent)?.getEntry(AttributeKeys.JUDGMENT_SESSION_ID)
        ?.value ?? sessionId;
    writeSpans(invocation, turn.parent, judgmentSessionId);
  } catch (err) {
    Logger.error(
      `[Caught] An exception was raised in wrapAnthropicManagedAgents.exportTurn: ${String(err)}`,
    );
  }
}
