import { Logger } from "../../../utils/logger";
import { within } from "./events";
import type {
  AgentConfig,
  ManagedAgentsApi,
  RequestOptions,
  SessionEvent,
} from "./types";

/** Bounds the extra API calls made when a turn is exported. */
const LOOKUP_OPTIONS: RequestOptions = { timeout: 5_000, maxRetries: 1 };

/** One agent thread (the primary agent or a sub-agent) and what it did in a turn. */
export interface AgentRun {
  name: string;
  model?: string;
  system?: string;
  /** Set for sub-agents. */
  threadId?: string;
  /** The thread's events during the turn, oldest first. */
  events: SessionEvent[];
}

export function isSubAgent(run: AgentRun): boolean {
  return run.threadId !== undefined;
}

/**
 * The agents that took part in a turn: the primary agent first, then its
 * sub-agents. The stream only carries the primary agent's own events, so the
 * rest is read from the sessions API.
 */
export async function loadAgents(
  client: ManagedAgentsApi,
  sessionId: string,
  turn: SessionEvent[],
): Promise<AgentRun[]> {
  const { sessions } = client.beta;
  const [session, subAgents] = await Promise.all([
    lookup("sessions.retrieve", () =>
      sessions.retrieve(sessionId, null, LOOKUP_OPTIONS),
    ),
    loadSubAgents(client, sessionId, turn),
  ]);
  const primaryEvents = turn.filter((event) => !event.session_thread_id);
  return [toAgentRun(session?.agent, primaryEvents), ...subAgents];
}

async function loadSubAgents(
  client: ManagedAgentsApi,
  sessionId: string,
  turn: SessionEvent[],
): Promise<AgentRun[]> {
  const threadIds = new Set(turn.flatMap(threadIdsOf));
  if (threadIds.size === 0) return [];

  const { threads } = client.beta.sessions;
  const allThreads = await lookup("sessions.threads.list", () =>
    collect(threads.list(sessionId, null, LOOKUP_OPTIONS)),
  );
  const subAgentThreads = (allThreads ?? []).filter(
    (thread) => thread.parent_thread_id && threadIds.has(thread.id),
  );
  const duringTurn = within(turn);
  const runs = await Promise.all(
    subAgentThreads.map(async (thread) => {
      const events = await loadThreadEvents(client, sessionId, thread.id);
      return (
        events && toAgentRun(thread.agent, events.filter(duringTurn), thread.id)
      );
    }),
  );
  return runs.filter((run) => run !== undefined);
}

function loadThreadEvents(
  client: ManagedAgentsApi,
  sessionId: string,
  threadId: string,
): Promise<SessionEvent[] | undefined> {
  return lookup("sessions.threads.events.list", () =>
    collect(
      client.beta.sessions.threads.events.list(
        threadId,
        { session_id: sessionId },
        LOOKUP_OPTIONS,
      ),
    ),
  );
}

function toAgentRun(
  config: AgentConfig | undefined,
  events: SessionEvent[],
  threadId?: string,
): AgentRun {
  const model = config?.model;
  return {
    name: config?.name ?? "agent",
    model: typeof model === "string" ? model : model?.id,
    system: config?.system ?? undefined,
    threadId,
    events,
  };
}

/** The threads `event` belongs to or messages between. */
function threadIdsOf(event: SessionEvent): string[] {
  return [
    event.session_thread_id,
    event.to_session_thread_id,
    event.from_session_thread_id,
  ].filter((id) => typeof id === "string");
}

async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];
  for await (const item of items) collected.push(item);
  return collected;
}

/**
 * Await an API call that only adds detail to the trace. A failure is logged
 * and the trace is exported without that detail.
 */
async function lookup<T>(
  label: string,
  call: () => PromiseLike<T>,
): Promise<T | undefined> {
  try {
    return await call();
  } catch (err) {
    Logger.error(
      `[Caught] Managed Agents ${label} failed, so the trace will lack detail: ${String(err)}`,
    );
    return undefined;
  }
}
