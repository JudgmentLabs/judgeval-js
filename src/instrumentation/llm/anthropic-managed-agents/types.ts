/**
 * Structural types for the parts of the Anthropic SDK (`@anthropic-ai/sdk`)
 * read by the Managed Agents instrumentation. They are declared here so that
 * `judgeval` does not depend on the SDK.
 */

export interface ContentBlock {
  type?: string;
  text?: string;
}

/** An event from `sessions.events.stream()` or `sessions.threads.events.list()`. */
export interface SessionEvent {
  type: string;
  id: string;
  processed_at?: string | null;
  session_thread_id?: string | null;
  content?: ContentBlock[] | string;
  // Tool calls and their results
  name?: string;
  input?: unknown;
  is_error?: boolean | null;
  mcp_server_name?: string;
  tool_use_id?: string;
  mcp_tool_use_id?: string;
  custom_tool_use_id?: string;
  // Tool confirmations
  result?: string;
  deny_message?: string | null;
  // Model requests
  model_request_start_id?: string;
  model_usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
  // Session status and errors
  stop_reason?: { type: string };
  error?: { type: string; message: string; retry_status?: { type: string } };
  // Messages between agent threads
  to_agent_name?: string;
  to_session_thread_id?: string;
  from_agent_name?: string;
  from_session_thread_id?: string;
}

export interface AgentConfig {
  name?: string;
  system?: string | null;
  model?: { id?: string } | string | null;
}

export interface SessionThread {
  id: string;
  parent_thread_id: string | null;
  agent?: AgentConfig;
}

export interface RequestOptions {
  timeout: number;
  maxRetries: number;
}

/** The parts of the Anthropic client the instrumentation calls. */
export interface ManagedAgentsApi {
  beta: {
    sessions: {
      retrieve(
        sessionId: string,
        params: null,
        options: RequestOptions,
      ): PromiseLike<{ agent?: AgentConfig }>;
      events: {
        stream(
          sessionId: string,
          ...rest: unknown[]
        ): Promise<AsyncIterable<SessionEvent>>;
      };
      threads: {
        list(
          sessionId: string,
          params: null,
          options: RequestOptions,
        ): AsyncIterable<SessionThread>;
        events: {
          list(
            threadId: string,
            params: { session_id: string },
            options: RequestOptions,
          ): AsyncIterable<SessionEvent>;
        };
      };
    };
  };
}

/** What `wrap()` accepts: any client exposing `beta.sessions.events.stream`. */
export interface ManagedAgentsClientLike {
  beta: {
    sessions: {
      events: { stream: (...args: never[]) => unknown };
    };
  };
}
