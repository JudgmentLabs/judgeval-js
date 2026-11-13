import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { JudgmentApiClient } from "../internal/api/client";
import {
  ObservationExporter,
  type SentObservation,
} from "./ObservationExporter";

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
      return Promise.resolve({
        response,
        error: response.ok ? undefined : { error: "failed" },
      });
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

  test("one observation that does not fit the format does not drop the others", async () => {
    const fake = fakeClient((batch) =>
      batch.some((item) => item.observation.conversation_id === "bad")
        ? 400
        : 200,
    );
    await exportTo(
      fake.client,
      ["a", "bad", "b", "c"].map((name) => sent(name)),
    );
    const stored = fake.stored
      .flat()
      .map((item) => item.observation.conversation_id)
      .sort();
    expect(stored).toEqual(["a", "b", "c"]);
  });

  test("a request the server rejects whole is dropped after one split", async () => {
    // For example, a clock more than five minutes fast.
    const fake = fakeClient(() => 400);
    await exportTo(
      fake.client,
      Array.from({ length: 100 }, (_, index) => sent(String(index))),
    );
    expect([fake.attempts(), fake.stored]).toEqual([3, []]);
  });
});
