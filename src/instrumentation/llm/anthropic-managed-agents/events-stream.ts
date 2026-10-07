import type { Anthropic } from "@anthropic-ai/sdk";
import {
  immutableWrapAsync,
  proxyAsyncIterable,
} from "../../../utils/wrappers";
import { endsTurn, exportTurn, type SessionEvent } from "./turn";

/**
 * Wrap `client.beta.sessions.events.stream` to export one span per turn of
 * the session.
 */
export function wrapEventsStream(client: Anthropic): void {
  const { events } = client.beta.sessions;
  events.stream = immutableWrapAsync(events.stream.bind(events), {
    post: (_ctx, stream, [sessionId]) => {
      let turn: SessionEvent[] = [];
      proxyAsyncIterable(stream, {
        onYield(event) {
          turn.push(event);
          if (endsTurn(event)) {
            exportTurn(turn, sessionId);
            turn = [];
          }
        },
        onDone() {},
        onError() {},
        onFinally() {
          exportTurn(turn, sessionId);
        },
      });
    },
  });
}
