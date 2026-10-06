/**
 * Structural types for the parts of the Anthropic SDK (`@anthropic-ai/sdk`)
 * the Managed Agents instrumentation touches. Declared structurally so
 * `judgeval` does not need `@anthropic-ai/sdk` as a dependency.
 */

export interface ContentBlock {
  type?: string;
  text?: string;
}

/** A Managed Agents session event (`client.beta.sessions.events.*`). */
export interface ManagedAgentEvent {
  type: string;
  id?: string;
  processed_at?: string | null;
  session_thread_id?: string | null;
  content?: ContentBlock[] | string;
  name?: string;
  input?: unknown;
  is_error?: boolean | null;
  // tool results
  tool_use_id?: string;
  mcp_tool_use_id?: string;
  custom_tool_use_id?: string;
  mcp_server_name?: string;
  // permission / confirmation
  evaluated_permission?: string;
  result?: string;
  deny_message?: string | null;
  // model requests
  model_request_start_id?: string;
  model_usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  // idle / error / usage
  stop_reason?: { type: string; event_ids?: string[] };
  error?: {
    type?: string;
    message?: string;
    mcp_server_name?: string;
    retry_status?: { type?: string };
  };
  usage?: { list_cost?: { amount?: string } | null };
  // multi-agent threads
  agent_name?: string;
  to_agent_name?: string;
  to_session_thread_id?: string;
  from_agent_name?: string;
  from_session_thread_id?: string;
}

export interface ManagedAgentConfig {
  name?: string;
  system?: string | null;
  model?: { id?: string } | string | null;
}

export interface ManagedAgentThread {
  id: string;
  agent?: ManagedAgentConfig;
}

export interface ManagedAgentSession {
  agent?: ManagedAgentConfig;
}

/** What `wrap()` accepts: any client exposing `beta.sessions.events.stream`. */
export interface ManagedAgentsClientLike {
  beta: {
    sessions: {
      events: { stream: (...args: never[]) => unknown };
    };
  };
}

/** The subset of the Anthropic client used internally once a client is wrapped. */
export interface ManagedAgentsApi {
  beta: {
    sessions: {
      retrieve(sessionId: string): PromiseLike<ManagedAgentSession>;
      events: {
        stream: (
          sessionId: string,
          ...rest: unknown[]
        ) => PromiseLike<AsyncIterable<ManagedAgentEvent>>;
      };
      threads: {
        list(sessionId: string): AsyncIterable<ManagedAgentThread>;
        events: {
          list(
            threadId: string,
            params: { session_id: string },
          ): AsyncIterable<ManagedAgentEvent>;
        };
      };
    };
  };
}
