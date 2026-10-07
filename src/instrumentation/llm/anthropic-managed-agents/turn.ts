import { trace, type Context } from "@opentelemetry/api";
import type {
  BetaManagedAgentsSpanModelRequestEndEvent,
  BetaManagedAgentsStreamSessionEvents,
} from "@anthropic-ai/sdk/resources/beta/sessions/events";
import type { BetaManagedAgentsSessionAgent } from "@anthropic-ai/sdk/resources/beta/sessions/sessions";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { BaseTracer, type LLMMetadata } from "../../../trace/BaseTracer";
import { createBaggage, getBaggage, setBaggage } from "../../../trace/baggage";
import { getTraceRuntime } from "../../../trace/runtime";
import {
  isModelOutput,
  textOf,
  timeOf,
  toCall,
  toMessages,
  toResult,
} from "./messages";

export type SessionEvent = BetaManagedAgentsStreamSessionEvents;

interface SpanData {
  name: string;
  kind: string;
  start: Date;
  end: Date;
  input?: unknown;
  output?: unknown;
  llm?: LLMMetadata;
  error?: string;
}

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

/** Export a turn as a trace: the agent run, its model requests and its tool calls. */
export function exportTurn(
  turn: SessionEvent[],
  agent: BetaManagedAgentsSessionAgent | undefined,
  sessionId: string,
): void {
  // Events cross-posted from a sub-agent's thread belong to that thread.
  const events = turn.filter(
    (event) => !("session_thread_id" in event && event.session_thread_id),
  );
  if (!events.some(isConversation)) return;

  const parent = withSessionId(
    getTraceRuntime().getCurrentContext(),
    sessionId,
  );
  writeSpan(
    parent,
    {
      name: agent ? `invoke_agent ${agent.name}` : "invoke_agent",
      kind: "agent",
      start: timeOf(events[0]),
      end: timeOf(events[events.length - 1]),
      input: toMessages(
        events.filter((event) => event.type === "user.message"),
      ),
      output: textOf(
        events.filter((e) => e.type === "agent.message").pop()?.content,
      ),
      error: failureOf(events),
    },
    (context) => {
      writeModelRequests(events, agent, context);
      writeToolCalls(events, context);
    },
  );
}

function isConversation(event: SessionEvent): boolean {
  return event.type.startsWith("user.") || event.type.startsWith("agent.");
}

/** Group by the Managed Agents session unless the app set a session ID. */
function withSessionId(context: Context, sessionId: string): Context {
  const baggage = getBaggage(context) ?? createBaggage();
  if (baggage.getEntry(AttributeKeys.JUDGMENT_SESSION_ID)) return context;
  return setBaggage(
    context,
    baggage.setEntry(AttributeKeys.JUDGMENT_SESSION_ID, { value: sessionId }),
  );
}

function writeSpan(
  parent: Context,
  data: SpanData,
  writeChildren?: (context: Context) => void,
): void {
  const span = BaseTracer.getOTELTracer().startSpan(
    data.name,
    { startTime: data.start },
    parent,
  );
  BaseTracer.setSpanKind(data.kind, span);
  BaseTracer.setInput(data.input, span);
  BaseTracer.setOutput(data.output, span);
  if (data.llm) BaseTracer.recordLLMMetadata(data.llm, span);
  if (data.error) BaseTracer.setError(new Error(data.error), span);
  writeChildren?.(trace.setSpan(parent, span));
  span.end(data.end);
}

/**
 * One span per model request. A request owns the messages and tool calls
 * the model produced before the next request starts.
 */
function writeModelRequests(
  events: SessionEvent[],
  agent: BetaManagedAgentsSessionAgent | undefined,
  context: Context,
): void {
  const model = agent?.model.id;
  const ends = new Map<string, BetaManagedAgentsSpanModelRequestEndEvent>();
  for (const event of events) {
    if (event.type === "span.model_request_end") {
      ends.set(event.model_request_start_id, event);
    }
  }

  events.forEach((start, index) => {
    if (start.type !== "span.model_request_start") return;
    const end = ends.get(start.id);
    if (!end) return;

    const later = events.slice(index + 1);
    const nextStart = later.findIndex(
      (e) => e.type === "span.model_request_start",
    );
    const produced = later.slice(0, nextStart < 0 ? undefined : nextStart);
    writeSpan(context, {
      name: model ? `generate_content ${model}` : "generate_content",
      kind: "llm",
      start: timeOf(start),
      end: timeOf(end),
      input: [
        ...(agent?.system ? [{ role: "system", content: agent.system }] : []),
        ...toMessages(events.slice(0, index)),
      ],
      output: toMessages(produced.filter(isModelOutput)),
      llm: {
        model,
        provider: "anthropic",
        non_cached_input_tokens: end.model_usage.input_tokens,
        output_tokens: end.model_usage.output_tokens,
        cache_read_input_tokens: end.model_usage.cache_read_input_tokens,
        cache_creation_input_tokens:
          end.model_usage.cache_creation_input_tokens,
      },
      error: end.is_error ? "Model request failed" : undefined,
    });
  });
}

/** One span per tool call. A call without a result lasts until the turn ends. */
function writeToolCalls(events: SessionEvent[], context: Context): void {
  const turnEnd = timeOf(events[events.length - 1]);
  events.forEach((event, index) => {
    const call = toCall(event);
    if (!call) return;

    const resultEvent = events
      .slice(index + 1)
      .find((later) => toResult(later)?.callId === call.id);
    const result = resultEvent && toResult(resultEvent);
    writeSpan(context, {
      name: `execute_tool ${call.name}`,
      kind: "tool",
      start: timeOf(event),
      end: resultEvent ? timeOf(resultEvent) : turnEnd,
      input: call.input,
      output: result?.output,
      error: result?.isError
        ? result.output || "Tool execution failed"
        : undefined,
    });
  });
}

/** Why the turn failed, if it did. */
function failureOf(events: SessionEvent[]): string | undefined {
  for (const event of events) {
    switch (event.type) {
      case "session.error":
        if (event.error.retry_status.type !== "retrying") {
          return `${event.error.type}: ${event.error.message}`;
        }
        break;
      case "session.status_idle":
        if (
          ["retries_exhausted", "budget_reached"].includes(
            event.stop_reason.type,
          )
        ) {
          return event.stop_reason.type;
        }
        break;
      case "session.status_terminated":
        return "session terminated";
    }
  }
  return undefined;
}
