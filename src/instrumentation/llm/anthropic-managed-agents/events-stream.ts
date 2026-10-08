import type { Anthropic } from "@anthropic-ai/sdk";
import type {
  BetaManagedAgentsSpanModelRequestEndEvent,
  BetaManagedAgentsStreamSessionEvents as SessionEvent,
} from "@anthropic-ai/sdk/resources/beta/sessions/events";
import type { BetaManagedAgentsSessionThreadAgent } from "@anthropic-ai/sdk/resources/beta/agents/agents";
import type { BetaManagedAgentsSessionAgent } from "@anthropic-ai/sdk/resources/beta/sessions/sessions";
import { trace, type Context, type Span } from "@opentelemetry/api";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { BaseTracer } from "../../../trace/BaseTracer";
import { getBaggage } from "../../../trace/baggage";
import { getTraceRuntime } from "../../../trace/runtime";
import { Logger } from "../../../utils/logger";
import {
  immutableWrapAsync,
  proxyAsyncIterable,
} from "../../../utils/wrappers";

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_call_id?: string;
  tool_calls?: { id: string; name: string; input: unknown }[];
}

function textOf(content: { type: string; text?: string }[] = []): string {
  return content.map((block) => block.text ?? "").join("");
}

/**
 * The conversation message carried by an event, if any. For the coordinator, a
 * message to a sub-agent is a tool call and its reply the tool result. In the
 * sub-agent's own thread, they are the user's message and the agent's answer.
 */
function toMessage(
  event: SessionEvent,
  delegated: boolean,
): Message | undefined {
  switch (event.type) {
    case "user.message":
      return { role: "user", content: textOf(event.content) };
    case "agent.message":
      return { role: "assistant", content: textOf(event.content) };
    case "agent.tool_use":
    case "agent.mcp_tool_use":
    case "agent.custom_tool_use":
      return {
        role: "assistant",
        tool_calls: [{ id: event.id, name: event.name, input: event.input }],
      };
    case "agent.tool_result":
      return {
        role: "tool",
        tool_call_id: event.tool_use_id,
        content: textOf(event.content),
      };
    case "agent.mcp_tool_result":
      return {
        role: "tool",
        tool_call_id: event.mcp_tool_use_id,
        content: textOf(event.content),
      };
    case "user.custom_tool_result":
      return {
        role: "tool",
        tool_call_id: event.custom_tool_use_id,
        content: textOf(event.content),
      };
    case "agent.thread_message_sent":
      if (delegated)
        return { role: "assistant", content: textOf(event.content) };
      return {
        role: "assistant",
        tool_calls: [
          {
            id: event.to_session_thread_id,
            name: "transfer_to_agent",
            input: {
              agent_name: event.to_agent_name,
              message: textOf(event.content),
            },
          },
        ],
      };
    case "agent.thread_message_received":
      if (delegated) return { role: "user", content: textOf(event.content) };
      return {
        role: "tool",
        tool_call_id: event.from_session_thread_id,
        content: textOf(event.content),
      };
    default:
      return undefined;
  }
}

/**
 * Turns the events of a session into spans: an `invoke_agent` span per turn,
 * with a `generate_content` span per model request and an `execute_tool` span
 * per tool call.
 */
class SessionRecorder {
  error?: string;

  private history: Message[] = [];
  private tools = new Map<string, Span>();
  private delegatedAt = new Map<string, Date>();
  private traceSessionId?: string;
  private turn?: {
    span: Span;
    context: Context;
    input: Message[];
    output: string;
  };
  private request?: {
    span: Span;
    input: Message[];
    output: Message[];
    end?: { time: Date; event: BetaManagedAgentsSpanModelRequestEndEvent };
  };

  constructor(
    private client: Anthropic,
    private sessionId: string,
    private source: {
      agent: () =>
        | BetaManagedAgentsSessionAgent
        | BetaManagedAgentsSessionThreadAgent
        | undefined;
      parent: () => Context;
      delegated?: boolean;
    },
  ) {}

  record(event: SessionEvent): void {
    const time =
      "processed_at" in event && event.processed_at
        ? new Date(event.processed_at)
        : new Date();
    const message = toMessage(event, this.source.delegated ?? false);

    if (message && !this.turn) {
      const parent = this.source.parent();
      // A session ID the app set on the trace wins over the Managed Agents one.
      this.traceSessionId = getBaggage(parent)?.getEntry(
        AttributeKeys.JUDGMENT_SESSION_ID,
      )?.value;
      const span = this.startSpan("invoke_agent", "agent", time, parent);
      this.turn = {
        span,
        context: trace.setSpan(parent, span),
        input: [],
        output: "",
      };
    }

    switch (event.type) {
      case "span.model_request_start":
        this.endRequest();
        if (this.turn) {
          this.request = {
            span: this.startSpan(
              "generate_content",
              "llm",
              time,
              this.turn.context,
            ),
            input: [...this.history],
            output: [],
          };
        }
        break;
      case "span.model_request_end":
        if (this.request) this.request.end = { time, event };
        break;
      case "session.error":
        if (event.error.retry_status.type !== "retrying") {
          this.error = `${event.error.type}: ${event.error.message}`;
        }
        break;
      case "session.status_idle":
      case "session.thread_status_idle":
        if (
          ["retries_exhausted", "budget_reached"].includes(
            event.stop_reason.type,
          )
        ) {
          this.error = event.stop_reason.type;
        }
        if (event.stop_reason.type !== "requires_action") this.endTurn(time);
        break;
      case "session.status_terminated":
        this.error = "session terminated";
        this.endTurn(time);
        break;
      case "session.deleted":
        this.endTurn(time);
        break;
    }

    if (!message || !this.turn) return;
    this.history.push(message);
    if (message.role === "user") this.turn.input.push(message);
    if (message.role === "assistant") this.request?.output.push(message);
    if (message.role === "assistant" && message.content) {
      this.turn.output = message.content;
    }

    const call = message.tool_calls?.[0];
    if (call) {
      const span = this.startSpan(
        `execute_tool ${call.name}`,
        "tool",
        time,
        this.turn.context,
      );
      BaseTracer.setInput(call.input, span);
      this.tools.set(call.id, span);
      if (event.type === "agent.thread_message_sent") {
        this.delegatedAt.set(call.id, time);
      }
    }

    const toolSpan = this.tools.get(message.tool_call_id ?? "");
    if (toolSpan) {
      BaseTracer.setOutput(message.content, toolSpan);
      if ("is_error" in event && event.is_error) {
        BaseTracer.setError(
          new Error(message.content || "Tool failed"),
          toolSpan,
        );
      }
      toolSpan.end(time);
      this.tools.delete(message.tool_call_id ?? "");

      if (event.type === "agent.thread_message_received") {
        const parent = trace.setSpan(this.turn.context, toolSpan);
        this.recordThread(event.from_session_thread_id, parent, time).catch(
          (err: unknown) => {
            Logger.error(`Failed to trace sub-agent thread: ${String(err)}`);
          },
        );
      }
    }
  }

  /**
   * The sub-agent's events are not in the session stream, so read them from
   * its thread once it has replied and record them under the transfer span.
   */
  private async recordThread(
    threadId: string,
    parent: Context,
    repliedAt: Date,
  ): Promise<void> {
    const since = this.delegatedAt.get(threadId) ?? repliedAt;
    const { threads } = this.client.beta.sessions;
    const params = { session_id: this.sessionId };
    const { agent } = await threads.retrieve(threadId, params);
    const sub = new SessionRecorder(this.client, this.sessionId, {
      agent: () => (agent.type === "agent" ? agent : undefined),
      parent: () => parent,
      delegated: true,
    });
    for await (const event of threads.events.list(threadId, params)) {
      if (new Date(event.processed_at ?? 0) < since) continue;
      sub.record(event);
      if (
        event.type === "session.thread_status_idle" &&
        event.stop_reason.type !== "requires_action"
      ) {
        return;
      }
    }
    sub.endTurn(repliedAt);
  }

  /** Ends the open turn, and fails the tool calls that never got a result. */
  endTurn(time: Date): void {
    if (!this.turn) return;
    this.endRequest();
    for (const span of this.tools.values()) {
      BaseTracer.setError(new Error(this.error ?? "No tool result"), span);
      span.end(time);
    }
    this.tools.clear();

    const { span, input, output } = this.turn;
    BaseTracer.setInput(input, span);
    BaseTracer.setOutput(output, span);
    if (this.error) BaseTracer.setError(new Error(this.error), span);
    span.end(time);
    this.turn = undefined;
    this.error = undefined;
  }

  /** A model request owns the messages produced until the next one starts. */
  private endRequest(): void {
    if (!this.request) return;
    const { span, input, output, end } = this.request;
    const agent = this.source.agent();

    BaseTracer.setInput(
      agent?.system
        ? [{ role: "system", content: agent.system }, ...input]
        : input,
      span,
    );
    BaseTracer.setOutput(output, span);
    if (end) {
      const usage = end.event.model_usage;
      BaseTracer.recordLLMMetadata(
        {
          model: agent?.model.id,
          provider: "anthropic",
          non_cached_input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cache_read_input_tokens: usage.cache_read_input_tokens,
          cache_creation_input_tokens: usage.cache_creation_input_tokens,
        },
        span,
      );
      if (end.event.is_error) {
        BaseTracer.setError(new Error("Model request failed"), span);
      }
    }
    span.end(end?.time);
    this.request = undefined;
  }

  private startSpan(
    name: string,
    kind: string,
    startTime: Date,
    parent: Context,
  ): Span {
    const span = BaseTracer.getOTELTracer().startSpan(
      name,
      { startTime },
      parent,
    );
    BaseTracer.setSpanKind(kind, span);
    BaseTracer.setAttribute(
      AttributeKeys.JUDGMENT_SESSION_ID,
      this.traceSessionId ?? this.sessionId,
      span,
    );
    return span;
  }
}

/**
 * Wrap `client.beta.sessions.events.stream` to produce one trace per turn of
 * the session.
 */
export function wrapEventsStream(client: Anthropic): void {
  const { events } = client.beta.sessions;
  events.stream = immutableWrapAsync(events.stream.bind(events), {
    post: (_ctx, stream, [sessionId]) => {
      // The stream carries neither the model nor the system prompt.
      let agent: BetaManagedAgentsSessionAgent | undefined;
      void client.beta.sessions.retrieve(sessionId).then(
        (session) => {
          agent = session.agent;
        },
        (err: unknown) => {
          Logger.error(
            `Failed to retrieve Managed Agents session: ${String(err)}`,
          );
        },
      );

      const recorder = new SessionRecorder(client, sessionId, {
        agent: () => agent,
        parent: () => getTraceRuntime().getCurrentContext(),
      });
      proxyAsyncIterable(stream, {
        onYield(event) {
          // Events cross-posted from a sub-agent's thread are recorded from the thread.
          if ("session_thread_id" in event && event.session_thread_id) return;
          recorder.record(event);
        },
        onDone() {},
        onError(err) {
          recorder.error = String(err);
        },
        onFinally() {
          recorder.endTurn(new Date());
        },
      });
    },
  });
}
