import type { LLMMetadata } from "../../../trace/BaseTracer";
import { isSubAgent, type AgentRun } from "./agents";
import {
  endOf,
  isModelOutput,
  isToolUse,
  lastReplyOf,
  stopReasonOf,
  textOf,
  timeOf,
  toolUseIdOf,
} from "./events";
import { toMessages } from "./messages";
import type { SessionEvent } from "./types";

/** A span to export, with the spans nested in it. */
export interface SpanNode {
  name: string;
  kind: "span" | "agent" | "llm" | "tool";
  /** Epoch milliseconds. */
  start: number;
  end: number;
  input?: unknown;
  output?: unknown;
  attributes?: Record<string, unknown>;
  llm?: LLMMetadata;
  /** Marks the span as failed with this message. */
  error?: string;
  children?: SpanNode[];
}

/** One turn of a session: everything between the user's message and the agent going idle. */
export interface Turn {
  sessionId: string;
  /** Every event the stream delivered during the turn. */
  events: SessionEvent[];
  /** The primary agent, then its sub-agents. */
  agents: AgentRun[];
  /** True when the stream ended before the turn did. */
  incomplete: boolean;
}

/**
 * Describe a turn as spans, shaped like Google ADK traces:
 *
 *   invocation
 *   ├─ invoke_agent <primary agent>
 *   │  ├─ generate_content <model>
 *   │  ├─ execute_tool <tool>
 *   │  └─ execute_tool transfer_to_agent
 *   └─ invoke_agent <sub-agent>
 */
export function buildInvocation(turn: Turn): SpanNode {
  const { events, agents } = turn;
  return {
    name: "invocation",
    kind: "span",
    start: timeOf(events[0]),
    end: endOf(events),
    input: toMessages(
      events.filter((event) => event.type === "user.message"),
      false,
    ),
    output: lastReplyOf(agents[0].events),
    attributes: {
      "anthropic.managed_agents.session_id": turn.sessionId,
      "anthropic.managed_agents.stop_reason": stopReasonOf(events),
      "anthropic.managed_agents.incomplete": turn.incomplete,
    },
    error: failureOf(turn),
    children: agents.flatMap((agent) => buildAgent(agent) ?? []),
  };
}

function buildAgent(run: AgentRun): SpanNode | undefined {
  const { events } = run;
  if (events.length === 0) return undefined;
  const sessionError = events.find((event) => event.type === "session.error");
  return {
    name: `invoke_agent ${run.name}`,
    kind: "agent",
    start: timeOf(events[0]),
    end: endOf(events),
    input: toMessages(events, isSubAgent(run)).slice(0, 1),
    output: lastReplyOf(events),
    attributes: {
      "gen_ai.operation.name": "invoke_agent",
      "gen_ai.agent.name": run.name,
      "anthropic.managed_agents.thread_id": run.threadId,
    },
    error: sessionError && describeError(sessionError),
    children: [
      ...buildModelRequests(run),
      ...buildToolCalls(events),
      ...(isSubAgent(run) ? [] : buildDelegations(events)),
    ],
  };
}

/**
 * One span per model request. A request runs from its
 * `span.model_request_start` event to the next one, and owns the messages and
 * tool calls the model produced in between.
 */
function buildModelRequests(run: AgentRun): SpanNode[] {
  const { events, model, system } = run;
  const startIndexes = events.flatMap((event, index) =>
    event.type === "span.model_request_start" ? [index] : [],
  );

  return startIndexes.flatMap((startIndex, position): SpanNode | [] => {
    const start = events[startIndex];
    const end = events.find(
      (event) =>
        event.type === "span.model_request_end" &&
        event.model_request_start_id === start.id,
    );
    if (!end) return [];

    const nextStartIndex = startIndexes[position + 1] ?? events.length;
    const outputs = events
      .slice(startIndex, nextStartIndex)
      .filter(isModelOutput);
    return {
      name: model ? `generate_content ${model}` : "generate_content",
      kind: "llm",
      start: timeOf(start),
      end: timeOf(end),
      input: [
        ...(system ? [{ role: "system", content: system }] : []),
        ...toMessages(events.slice(0, startIndex), isSubAgent(run)),
      ],
      output: toMessages(outputs, isSubAgent(run)),
      attributes: { "gen_ai.operation.name": "generate_content" },
      llm: {
        model,
        provider: "anthropic",
        non_cached_input_tokens: end.model_usage?.input_tokens,
        output_tokens: end.model_usage?.output_tokens,
        cache_read_input_tokens: end.model_usage?.cache_read_input_tokens,
        cache_creation_input_tokens:
          end.model_usage?.cache_creation_input_tokens,
      },
      error: end.is_error ? "Model request failed" : undefined,
    };
  });
}

/** One span per tool call. */
function buildToolCalls(events: SessionEvent[]): SpanNode[] {
  return events.filter(isToolUse).map((toolUse) => {
    const result = events.find((event) => toolUseIdOf(event) === toolUse.id);
    const confirmation = events.find(
      (event) =>
        event.type === "user.tool_confirmation" &&
        event.tool_use_id === toolUse.id,
    );
    // A denied tool call never runs, so the denial is what settles it.
    const settledBy =
      result ?? (confirmation?.result === "deny" ? confirmation : undefined);
    return {
      name: `execute_tool ${toolUse.name}`,
      kind: "tool",
      start: timeOf(toolUse),
      end: settledBy ? timeOf(settledBy) : endOf(events),
      input: toolUse.input,
      output: result ? textOf(result.content) : "",
      attributes: {
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.name": toolUse.name,
        "anthropic.managed_agents.mcp_server": toolUse.mcp_server_name,
      },
      error: toolFailure(result, confirmation),
      children: confirmation
        ? [buildConfirmationWait(toolUse, confirmation)]
        : [],
    };
  });
}

/** The time a tool call waited for the app or user to allow or deny it. */
function buildConfirmationWait(
  toolUse: SessionEvent,
  confirmation: SessionEvent,
): SpanNode {
  return {
    name: "await_user_confirmation",
    kind: "span",
    start: timeOf(toolUse),
    end: timeOf(confirmation),
    output: confirmation.deny_message
      ? `${confirmation.result}: ${confirmation.deny_message}`
      : confirmation.result,
  };
}

function toolFailure(
  result: SessionEvent | undefined,
  confirmation: SessionEvent | undefined,
): string | undefined {
  if (confirmation?.result === "deny") {
    return confirmation.deny_message
      ? `denied by user: ${confirmation.deny_message}`
      : "denied by user";
  }
  if (result?.is_error)
    return textOf(result.content) || "Tool execution failed";
  return undefined;
}

/** A coordinator's messages to its sub-agents, shown like ADK's `transfer_to_agent` tool call. */
function buildDelegations(events: SessionEvent[]): SpanNode[] {
  return events.flatMap((sent, index): SpanNode | [] => {
    if (sent.type !== "agent.thread_message_sent") return [];
    const reply = events
      .slice(index)
      .find(
        (event) =>
          event.type === "agent.thread_message_received" &&
          event.from_session_thread_id === sent.to_session_thread_id,
      );
    return {
      name: "execute_tool transfer_to_agent",
      kind: "tool",
      start: timeOf(sent),
      end: reply ? timeOf(reply) : endOf(events),
      input: { agent_name: sent.to_agent_name, message: textOf(sent.content) },
      output: reply ? textOf(reply.content) : "",
      attributes: {
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.name": "transfer_to_agent",
      },
    };
  });
}

/** Why a turn failed, if it did: a fatal error, an exhausted budget or retries, or termination. */
function failureOf({ events, agents }: Turn): string | undefined {
  const fatalError = agents
    .flatMap((agent) => agent.events)
    .find(
      (event) =>
        event.type === "session.error" &&
        ["exhausted", "terminal"].includes(
          event.error?.retry_status?.type ?? "",
        ),
    );
  if (fatalError) return describeError(fatalError);

  const stopReason = stopReasonOf(events);
  if (stopReason === "retries_exhausted" || stopReason === "budget_reached") {
    return stopReason;
  }
  if (events.some((event) => event.type === "session.status_terminated")) {
    return "session terminated";
  }
  return undefined;
}

function describeError(event: SessionEvent): string {
  return `${event.error?.type}: ${event.error?.message}`;
}
