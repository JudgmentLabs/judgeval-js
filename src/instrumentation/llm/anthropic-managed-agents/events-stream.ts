import type { Anthropic } from "@anthropic-ai/sdk";
import type { BetaManagedAgentsSessionAgent } from "@anthropic-ai/sdk/resources/beta/sessions/sessions";
import { Logger } from "../../../utils/logger";
import {
  immutableWrapAsync,
  proxyAsyncIterable,
} from "../../../utils/wrappers";
import { endsTurn, exportTurn, type SessionEvent } from "./turn";

/**
 * Wrap `client.beta.sessions.events.stream` to produce one trace per turn of
 * the session.
 */
export function wrapEventsStream(client: Anthropic): void {
  const { events } = client.beta.sessions;
  events.stream = immutableWrapAsync(events.stream.bind(events), {
    post: (_ctx, stream, [sessionId]) => {
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

      let turn: SessionEvent[] = [];
      proxyAsyncIterable(stream, {
        onYield(event) {
          turn.push(event);
          if (endsTurn(event)) {
            exportTurn(turn, agent, sessionId);
            turn = [];
          }
        },
        onDone() {},
        onError() {},
        onFinally() {
          exportTurn(turn, agent, sessionId);
        },
      });
    },
  });
}
