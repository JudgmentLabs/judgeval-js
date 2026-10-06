import type { Context } from "@opentelemetry/api";
import { getTraceRuntime } from "../../../trace/runtime";
import { isTurnEnd } from "./events";
import type { StreamedTurn } from "./export-turn";
import type { SessionEvent } from "./types";

/**
 * Replace the stream's `[Symbol.asyncIterator]` so that `onTurn` is called with
 * each turn. Events reach the caller unchanged.
 *
 * `onTurn` is awaited before the event that ends the turn is released, so the
 * caller can safely `Tracer.forceFlush()` as soon as it sees that event.
 */
export function proxyTurns(
  stream: AsyncIterable<SessionEvent>,
  onTurn: (turn: StreamedTurn) => Promise<void>,
): void {
  const original = stream[Symbol.asyncIterator].bind(stream);
  stream[Symbol.asyncIterator] = () =>
    iterateTurns(
      { [Symbol.asyncIterator]: original },
      onTurn,
      getTraceRuntime().getCurrentContext(),
    );
}

async function* iterateTurns(
  source: AsyncIterable<SessionEvent>,
  onTurn: (turn: StreamedTurn) => Promise<void>,
  parent: Context,
): AsyncGenerator<SessionEvent> {
  let events: SessionEvent[] = [];
  try {
    for await (const event of source) {
      events.push(event);
      if (isTurnEnd(event)) {
        await onTurn({ events, incomplete: false, parent });
        events = [];
      }
      yield event;
    }
  } finally {
    // The stream ended, or the caller stopped reading, partway through a turn.
    await onTurn({ events, incomplete: true, parent });
  }
}
