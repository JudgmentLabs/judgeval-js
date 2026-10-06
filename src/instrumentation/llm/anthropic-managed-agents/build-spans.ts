import {
  trace,
  SpanStatusCode,
  type Context,
  type Span,
  type Tracer,
} from "@opentelemetry/api";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { safeStringify } from "../../../utils/serializer";
import type { ManagedAgentEvent as Ev } from "./types";

const TOOL_USE = [
  "agent.tool_use",
  "agent.mcp_tool_use",
  "agent.custom_tool_use",
];

export const ms = (e?: Ev): number | undefined =>
  e?.processed_at ? Date.parse(e.processed_at) : undefined;

export function text(content: unknown): string {
  if (Array.isArray(content)) {
    return content
      .map((b: { type?: string; text?: string }) =>
        b?.type === "text" ? (b.text ?? "") : "",
      )
      .join("");
  }
  return typeof content === "string" ? content : "";
}

const json = (v: unknown): string =>
  typeof v === "string" ? v : safeStringify(v);

function resultId(e: Ev): string | undefined {
  if (e.type === "agent.tool_result") return e.tool_use_id;
  if (e.type === "agent.mcp_tool_result") return e.mcp_tool_use_id;
  if (e.type === "user.custom_tool_result") return e.custom_tool_use_id;
  return undefined;
}

/**
 * A turn ends at idle unless the session is waiting on a tool result or a
 * tool confirmation (`requires_action`), or when it terminates / is deleted.
 */
export function isTurnEnd(e: Ev): boolean {
  return (
    e.type === "session.status_terminated" ||
    e.type === "session.deleted" ||
    (e.type === "session.status_idle" &&
      e.stop_reason?.type !== "requires_action")
  );
}

/** One agent thread (the primary agent, or a sub-agent) taking part in a turn. */
export interface AgentRun {
  name: string;
  model?: string;
  system?: string;
  threadId?: string;
  isChild: boolean;
  /** Full thread history, oldest first. */
  events: Ev[];
  /** Index of the first event that belongs to this turn. */
  from: number;
}

interface Message {
  role: string;
  content?: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: { id?: string; name?: string; input: unknown }[];
}

function toMessages(events: Ev[], isChild: boolean): Message[] {
  const out: Message[] = [];
  for (const e of events) {
    const rid = resultId(e);
    if (e.type === "user.message") {
      out.push({ role: "user", content: text(e.content) });
    } else if (e.type === "agent.message") {
      out.push({ role: "assistant", content: text(e.content) });
    } else if (TOOL_USE.includes(e.type)) {
      out.push({
        role: "assistant",
        tool_calls: [{ id: e.id, name: e.name, input: e.input }],
      });
    } else if (rid) {
      out.push({ role: "tool", tool_call_id: rid, content: text(e.content) });
    } else if (e.type === "agent.thread_message_received") {
      out.push(
        isChild
          ? { role: "user", name: e.from_agent_name, content: text(e.content) }
          : {
              role: "tool",
              name: "transfer_to_agent",
              tool_call_id: e.from_session_thread_id,
              content: text(e.content),
            },
      );
    } else if (e.type === "agent.thread_message_sent") {
      out.push(
        isChild
          ? { role: "assistant", content: text(e.content) }
          : {
              role: "assistant",
              tool_calls: [
                {
                  id: e.to_session_thread_id,
                  name: "transfer_to_agent",
                  input: {
                    agent_name: e.to_agent_name,
                    message: text(e.content),
                  },
                },
              ],
            },
      );
    }
  }
  return out;
}

export interface TurnInfo {
  sessionId: string;
  /** The id written to `judgment.session_id` on every span. */
  traceSessionId: string;
  turn: Ev[];
  agents: AgentRun[];
  partial: boolean;
}

/**
 * Replay one finished turn as spans, shaped like Google ADK / Vertex traces:
 *
 *   invocation
 *   ├─ invoke_agent <primary>        (generate_content, execute_tool ...)
 *   └─ invoke_agent <sub-agent>      (one per sub-agent thread)
 */
export function emitTurn(
  tracer: Tracer,
  parent: Context,
  info: TurnInfo,
): string | undefined {
  const { turn, agents, sessionId, traceSessionId, partial } = info;
  const first = turn[0];
  if (!first) return undefined;
  const start = ms(first) ?? Date.now();
  const end = Math.max(ms(turn[turn.length - 1]) ?? start, start);
  const primary = agents[0];
  if (!primary) return undefined;

  const primaryTurn = primary.events.slice(primary.from);
  const finalMessage = [...primaryTurn]
    .reverse()
    .find((e) => e.type === "agent.message");
  const idle = [...turn]
    .reverse()
    .find((e) => e.type === "session.status_idle");
  const stop = idle?.stop_reason?.type;
  const terminated = turn.some((e) => e.type === "session.status_terminated");
  const errors = agents.flatMap((a) =>
    a.events.slice(a.from).filter((e) => e.type === "session.error"),
  );
  const fatal = errors.find((e) =>
    ["exhausted", "terminal"].includes(e.error?.retry_status?.type ?? ""),
  );
  const usage = [...turn]
    .reverse()
    .find((e) => e.type === "session.usage" && !e.session_thread_id)?.usage;
  const failure = fatal
    ? `${fatal.error?.type}: ${fatal.error?.message}`
    : stop === "retries_exhausted" || stop === "budget_reached"
      ? stop
      : terminated
        ? "session terminated"
        : undefined;

  const root = tracer.startSpan(
    "invocation",
    {
      startTime: start,
      attributes: {
        [AttributeKeys.JUDGMENT_SPAN_KIND]: "span",
        [AttributeKeys.JUDGMENT_SESSION_ID]: traceSessionId,
        "gen_ai.conversation.id": traceSessionId,
        [AttributeKeys.JUDGMENT_INPUT]: json(
          turn
            .filter((e) => e.type === "user.message")
            .map((e) => ({ role: "user", content: text(e.content) })),
        ),
        [AttributeKeys.JUDGMENT_OUTPUT]: text(finalMessage?.content),
        "anthropic.managed_agents.session_id": sessionId,
        ...(stop ? { "anthropic.managed_agents.stop_reason": stop } : {}),
        ...(partial ? { "anthropic.managed_agents.incomplete": true } : {}),
        ...(usage?.list_cost?.amount
          ? {
              "anthropic.managed_agents.session_list_cost_cents": Number(
                usage.list_cost.amount,
              ),
            }
          : {}),
        ...(agents.length > 1
          ? { "anthropic.managed_agents.threads": agents.length - 1 }
          : {}),
        ...(errors.length
          ? { "anthropic.managed_agents.error_count": errors.length }
          : {}),
      },
    },
    parent,
  );
  const rootCtx = trace.setSpan(parent, root);
  for (const a of agents) emitAgent(tracer, rootCtx, a, traceSessionId, end);
  if (failure) root.setStatus({ code: SpanStatusCode.ERROR, message: failure });
  root.end(end);
  return root.spanContext().traceId;
}

function emitAgent(
  tracer: Tracer,
  rootCtx: Context,
  a: AgentRun,
  sessionId: string,
  turnEnd: number,
): void {
  const ev = a.events;
  const mine = ev.slice(a.from);
  const firstMine = mine[0];
  if (!firstMine) return;
  const t0 = ms(firstMine) ?? Date.now();
  const t1 = Math.max(ms(mine[mine.length - 1]) ?? t0, t0);
  const common = {
    [AttributeKeys.JUDGMENT_SESSION_ID]: sessionId,
    "gen_ai.agent.name": a.name,
  };

  const agentSpan = tracer.startSpan(
    `invoke_agent ${a.name}`,
    {
      startTime: t0,
      attributes: {
        ...common,
        [AttributeKeys.JUDGMENT_SPAN_KIND]: "agent",
        "gen_ai.operation.name": "invoke_agent",
        [AttributeKeys.JUDGMENT_INPUT]: json(
          toMessages([firstMine], a.isChild),
        ),
        [AttributeKeys.JUDGMENT_OUTPUT]: text(
          [...mine]
            .reverse()
            .find(
              (e) =>
                e.type === "agent.message" ||
                e.type === "agent.thread_message_sent",
            )?.content,
        ),
        ...(a.threadId
          ? { "anthropic.managed_agents.thread_id": a.threadId }
          : {}),
      },
    },
    rootCtx,
  );
  const ctx = trace.setSpan(rootCtx, agentSpan);

  emitModelRequests(tracer, ctx, a, common);
  emitToolCalls(tracer, ctx, a, common, t0, turnEnd);
  if (!a.isChild) emitDelegations(tracer, ctx, a, common, t0, turnEnd);

  const errs = mine.filter((e) => e.type === "session.error");
  for (const e of errs) {
    agentSpan.addEvent(
      "session.error",
      {
        "error.type": e.error?.type ?? "",
        "error.message": e.error?.message ?? "",
        "error.retry_status": e.error?.retry_status?.type ?? "",
        ...(e.error?.mcp_server_name
          ? { "anthropic.managed_agents.mcp_server": e.error.mcp_server_name }
          : {}),
      },
      ms(e),
    );
  }
  const firstErr = errs[0];
  if (firstErr) {
    agentSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: `${firstErr.error?.type}: ${firstErr.error?.message}`,
    });
  }
  agentSpan.end(t1);
}

function emitModelRequests(
  tracer: Tracer,
  ctx: Context,
  a: AgentRun,
  common: Record<string, string>,
): void {
  const ev = a.events;
  const mine = ev.slice(a.from);
  const indexOf = new Map<Ev, number>(ev.map((e, i) => [e, i]));
  const byId = new Map<string, Ev>();
  for (const e of ev) if (e.id) byId.set(e.id, e);

  const requests = mine
    .filter((e) => e.type === "span.model_request_end")
    .map((end) => {
      const startEv = end.model_request_start_id
        ? byId.get(end.model_request_start_id)
        : undefined;
      return {
        startEv,
        end,
        from: (startEv ? indexOf.get(startEv) : indexOf.get(end)) ?? 0,
        outputs: [] as Ev[],
      };
    });
  // A request's outputs (messages, tool calls, delegations) belong to the
  // latest request that started before them.
  for (const e of mine) {
    if (
      e.type === "agent.message" ||
      TOOL_USE.includes(e.type) ||
      e.type === "agent.thread_message_sent"
    ) {
      const owner = [...requests]
        .reverse()
        .find((r) => (ms(r.startEv ?? r.end) ?? 0) <= (ms(e) ?? 0));
      owner?.outputs.push(e);
    }
  }

  for (const r of requests) {
    const u = r.end.model_usage ?? {};
    const endIdx = indexOf.get(r.end) ?? r.from;
    const thinking = ev
      .slice(r.from, endIdx + 1)
      .filter((e) => e.type === "agent.thinking").length;
    const span = tracer.startSpan(
      `generate_content ${a.model ?? ""}`.trim(),
      {
        startTime: ms(r.startEv) ?? ms(r.end),
        attributes: {
          ...common,
          [AttributeKeys.JUDGMENT_SPAN_KIND]: "llm",
          "gen_ai.operation.name": "generate_content",
          [AttributeKeys.JUDGMENT_LLM_PROVIDER]: "anthropic",
          ...(a.model
            ? {
                [AttributeKeys.JUDGMENT_LLM_MODEL_NAME]: a.model,
                [AttributeKeys.GEN_AI_REQUEST_MODEL]: a.model,
              }
            : {}),
          [AttributeKeys.JUDGMENT_USAGE_NON_CACHED_INPUT_TOKENS]:
            u.input_tokens ?? 0,
          [AttributeKeys.JUDGMENT_USAGE_OUTPUT_TOKENS]: u.output_tokens ?? 0,
          [AttributeKeys.JUDGMENT_USAGE_CACHE_READ_INPUT_TOKENS]:
            u.cache_read_input_tokens ?? 0,
          [AttributeKeys.JUDGMENT_USAGE_CACHE_CREATION_INPUT_TOKENS]:
            u.cache_creation_input_tokens ?? 0,
          [AttributeKeys.JUDGMENT_INPUT]: json([
            ...(a.system ? [{ role: "system", content: a.system }] : []),
            ...toMessages(ev.slice(0, r.from), a.isChild),
          ]),
          [AttributeKeys.JUDGMENT_OUTPUT]: json(
            toMessages(r.outputs, a.isChild),
          ),
          // Thinking content is not exposed by the API; only that it happened.
          ...(thinking
            ? { "anthropic.managed_agents.thinking_blocks": thinking }
            : {}),
        },
      },
      ctx,
    );
    if (r.end.is_error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: "Model request failed",
      });
    }
    span.end(ms(r.end));
  }
}

function emitToolCalls(
  tracer: Tracer,
  ctx: Context,
  a: AgentRun,
  common: Record<string, string>,
  t0: number,
  turnEnd: number,
): void {
  const results = new Map<string, Ev>();
  const confirmations = new Map<string, Ev>();
  for (const e of a.events) {
    const id = resultId(e);
    if (id) results.set(id, e);
    if (e.type === "user.tool_confirmation" && e.tool_use_id) {
      confirmations.set(e.tool_use_id, e);
    }
  }

  for (const use of a.events
    .slice(a.from)
    .filter((e) => TOOL_USE.includes(e.type))) {
    const result = use.id ? results.get(use.id) : undefined;
    const confirmation = use.id ? confirmations.get(use.id) : undefined;
    const denied = confirmation?.result === "deny";
    const startedAt = ms(use) ?? t0;
    const span = tracer.startSpan(
      `execute_tool ${use.name}`,
      {
        startTime: startedAt,
        attributes: {
          ...common,
          [AttributeKeys.JUDGMENT_SPAN_KIND]: "tool",
          "gen_ai.operation.name": "execute_tool",
          "gen_ai.tool.name": use.name ?? "",
          [AttributeKeys.JUDGMENT_INPUT]: json(use.input),
          [AttributeKeys.JUDGMENT_OUTPUT]: result ? text(result.content) : "",
          "anthropic.managed_agents.tool_type": use.type
            .replace("agent.", "")
            .replace("_use", ""),
          ...(use.mcp_server_name
            ? { "anthropic.managed_agents.mcp_server": use.mcp_server_name }
            : {}),
          ...(use.evaluated_permission
            ? {
                "anthropic.managed_agents.permission": use.evaluated_permission,
              }
            : {}),
          ...(confirmation?.result
            ? { "anthropic.managed_agents.confirmation": confirmation.result }
            : {}),
          ...(confirmation?.deny_message
            ? {
                "anthropic.managed_agents.deny_message":
                  confirmation.deny_message,
              }
            : {}),
          ...(result ? {} : { "anthropic.managed_agents.no_result": true }),
        },
      },
      ctx,
    );
    if (confirmation) {
      // Time the tool call spent waiting for the human / app to confirm it.
      const wait = tracer.startSpan(
        "await_user_confirmation",
        {
          startTime: startedAt,
          attributes: {
            [AttributeKeys.JUDGMENT_SPAN_KIND]: "span",
            [AttributeKeys.JUDGMENT_SESSION_ID]:
              common[AttributeKeys.JUDGMENT_SESSION_ID],
            [AttributeKeys.JUDGMENT_OUTPUT]:
              confirmation.result +
              (confirmation.deny_message
                ? `: ${confirmation.deny_message}`
                : ""),
          },
        },
        trace.setSpan(ctx, span),
      );
      wait.end(ms(confirmation) ?? startedAt);
    }
    if (denied) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `denied by user${confirmation?.deny_message ? `: ${confirmation.deny_message}` : ""}`,
      });
    } else if (result?.is_error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: text(result.content) || "Tool execution failed",
      });
    }
    span.end(
      Math.max(
        ms(result) ?? (denied ? ms(confirmation) : undefined) ?? turnEnd,
        startedAt,
      ),
    );
  }
}

/** Coordinator -> sub-agent messages, shaped like ADK's `transfer_to_agent` tool call. */
function emitDelegations(
  tracer: Tracer,
  ctx: Context,
  a: AgentRun,
  common: Record<string, string>,
  t0: number,
  turnEnd: number,
): void {
  const mine = a.events.slice(a.from);
  for (const sent of mine.filter(
    (e) => e.type === "agent.thread_message_sent",
  )) {
    const reply = mine.find(
      (e) =>
        e.type === "agent.thread_message_received" &&
        e.from_session_thread_id === sent.to_session_thread_id &&
        (ms(e) ?? 0) >= (ms(sent) ?? 0),
    );
    const span: Span = tracer.startSpan(
      "execute_tool transfer_to_agent",
      {
        startTime: ms(sent) ?? t0,
        attributes: {
          ...common,
          [AttributeKeys.JUDGMENT_SPAN_KIND]: "tool",
          "gen_ai.operation.name": "execute_tool",
          "gen_ai.tool.name": "transfer_to_agent",
          [AttributeKeys.JUDGMENT_INPUT]: json({
            agent_name: sent.to_agent_name,
            message: text(sent.content),
          }),
          [AttributeKeys.JUDGMENT_OUTPUT]: reply ? text(reply.content) : "",
          "anthropic.managed_agents.target_thread_id":
            sent.to_session_thread_id ?? "",
        },
      },
      ctx,
    );
    span.end(ms(reply) ?? turnEnd);
  }
}
