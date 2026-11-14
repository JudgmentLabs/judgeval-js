import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { JudgmentApiClient } from "../internal/api/client";
import {
  ObservationExporter,
  type SentObservation,
} from "./ObservationExporter";
import { Logger } from "../utils/logger";

type Respond = (batch: SentObservation[]) => number | Response;

/** Records each batch stored; `respond` returns each request's status. */
function fakeClient(respond: Respond = () => 200) {
  const stored: SentObservation[][] = [];
  let attempts = 0;
  const client = {
    postV1projectsObservations: (
      _projectId: string,
      payload: { observations: SentObservation[] },
    ) => {
      attempts += 1;
      const outcome = respond(payload.observations);
      const response =
        outcome instanceof Response
          ? outcome
          : new Response(null, { status: outcome });
      if (response.ok) stored.push(payload.observations);
      return (
        response.ok || !response.body
          ? Promise.resolve({ error: "failed" })
          : response.json()
      ).then((error) => ({
        response,
        error: response.ok ? undefined : error,
      }));
    },
  };
  return {
    client: client as unknown as JudgmentApiClient,
    stored,
    attempts: () => attempts,
  };
}

function sent(conversationId: string): SentObservation {
  return {
    observation: { conversation_id: conversationId, input: [] },
    observed_at: "2026-11-11T00:00:00.000Z",
  };
}

/** A 400 as the observations route sends it, with one issue per path. */
function rejection(...paths: unknown[][]): Response {
  const issues = paths.map((path) => ({ path, message: "Invalid input" }));
  return Response.json(
    {
      error: "Validation failed",
      message: JSON.stringify({ errors: issues, found: "the request" }),
    },
    { status: 400 },
  );
}

/** Rejects a batch that holds any of `names`, naming each by position. */
function rejectNamed(...names: string[]): Respond {
  return (batch) => {
    const paths = batch.flatMap((item, index) =>
      names.includes(item.observation.conversation_id)
        ? [["observations", index, "input"]]
        : [],
    );
    return paths.length > 0 ? rejection(...paths) : 200;
  };
}

let waits: number[];
let timer: ReturnType<typeof spyOn>;
beforeEach(() => {
  waits = [];
  // Record each backoff wait instead of waiting.
  timer = spyOn(globalThis, "setTimeout").mockImplementation(((
    callback: () => void,
    delay?: number,
  ) => {
    waits.push(delay ?? 0);
    callback();
    return 0;
  }) as unknown as typeof setTimeout);
});
afterEach(() => timer.mockRestore());

const exportTo = (client: JudgmentApiClient, batch: SentObservation[]) =>
  new ObservationExporter(client, "project-1").export(batch);

describe("ObservationExporter", () => {
  test("sends the batch", async () => {
    const fake = fakeClient();
    await exportTo(fake.client, [sent("a")]);
    expect([fake.stored, waits]).toEqual([[[sent("a")]], []]);
  });

  test("retries a temporary failure with backoff", async () => {
    let failures = 2;
    const fake = fakeClient(() => (failures-- > 0 ? 503 : 200));
    await exportTo(fake.client, [sent("a")]);
    expect([fake.stored.length, waits]).toEqual([1, [1000, 2000]]);
  });

  test("waits at least as long as Retry-After, but no longer than the cap", async () => {
    const responses = [
      new Response(null, { status: 429, headers: { "Retry-After": "5" } }),
      new Response(null, { status: 429, headers: { "Retry-After": "3600" } }),
    ];
    const fake = fakeClient(() => responses.shift() ?? 200);
    await exportTo(fake.client, [sent("a")]);
    expect(waits).toEqual([5000, 30000]);
  });

  test("a network failure is dropped after the last attempt, never rejecting", async () => {
    const client = {
      postV1projectsObservations: () =>
        Promise.reject(new Error("network down")),
    } as unknown as JudgmentApiClient;
    await expect(exportTo(client, [sent("a")])).resolves.toBeUndefined();
    expect(waits).toEqual([1000, 2000]);
  });

  for (const status of [401, 402, 403, 404]) {
    test(`does not retry a ${status}`, async () => {
      const fake = fakeClient(() => status);
      await exportTo(fake.client, [sent("a")]);
      expect([fake.attempts(), waits]).toEqual([1, []]);
    });
  }

  test("drops only the observations the server names", async () => {
    // In both halves, which a binary search could not tell from a fault in
    // the request as a whole.
    const fake = fakeClient(rejectNamed("bad-1", "bad-2"));
    await exportTo(
      fake.client,
      ["bad-1", "a", "b", "c", "d", "bad-2"].map((name) => sent(name)),
    );
    expect([fake.attempts(), fake.stored]).toEqual([
      2,
      [["a", "b", "c", "d"].map((name) => sent(name))],
    ]);
  });

  test("logs each issue without the echoed request", async () => {
    const logged = spyOn(Logger, "error").mockImplementation(() => undefined);
    await exportTo(fakeClient(rejectNamed("bad")).client, [
      sent("a"),
      sent("bad"),
    ]);
    const message = String(logged.mock.calls[0][0]);
    logged.mockRestore();
    expect(message).toContain("observations.1.input: Invalid input");
    expect(message).not.toContain("the request");
  });

  test("drops a batch the server rejects without naming an observation", async () => {
    const fake = fakeClient(() => rejection(["observations"]));
    await exportTo(
      fake.client,
      Array.from({ length: 100 }, (_, index) => sent(String(index))),
    );
    expect([fake.attempts(), fake.stored]).toEqual([1, []]);
  });
});
