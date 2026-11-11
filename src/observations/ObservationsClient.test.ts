import { describe, expect, test } from "bun:test";
import type { JudgmentApiClient } from "../internal/api/client";
import type { Observation } from "../internal/api/models";
import { ObservationsClient } from "./ObservationsClient";

type Batch = {
  observation: Observation;
  observed_at: string;
  environment?: string;
}[];

/** Records each batch sent; `respond` returns each request's status. */
function fakeClient(respond: (batch: Batch) => number = () => 200) {
  const batches: Batch[] = [];
  let attempts = 0;
  const client = {
    postV1projectsObservations: (
      _projectId: string,
      payload: { observations: Batch },
    ) => {
      attempts += 1;
      const batch = structuredClone(payload.observations);
      const status = respond(batch);
      if (status === 200) batches.push(batch);
      return Promise.resolve({
        response: new Response(null, { status }),
        error: status === 200 ? undefined : { error: "failed" },
      });
    },
  };
  return {
    client: client as unknown as JudgmentApiClient,
    batches,
    attempts: () => attempts,
  };
}

function call(conversationId = "ticket-1", text = "Hi"): Observation {
  return {
    conversation_id: conversationId,
    input: [
      { type: "message", role: "user", content: [{ type: "text", text }] },
    ],
  };
}

describe("ObservationsClient", () => {
  test("sends a recorded call with its time and environment", async () => {
    const fake = fakeClient();
    const observations = new ObservationsClient(fake.client, "project-1");
    observations.record(call(), {
      observedAt: new Date("2026-09-25T12:00:01Z"),
      environment: "production",
    });
    await observations.flush();
    expect(fake.batches).toEqual([
      [
        {
          observation: call(),
          observed_at: "2026-09-25T12:00:01.000Z",
          environment: "production",
        },
      ],
    ]);
  });

  test("sends at most one hundred calls per request", async () => {
    const fake = fakeClient();
    const observations = new ObservationsClient(fake.client, "project-1");
    for (let index = 0; index < 250; index++) {
      observations.record(call("ticket-1", String(index)));
    }
    await observations.flush();
    expect(fake.batches.map((batch) => batch.length)).toEqual([100, 100, 50]);
  });

  test("a send failure never reaches the caller", async () => {
    const client = {
      postV1projectsObservations: () =>
        Promise.reject(new Error("network down")),
    } as unknown as JudgmentApiClient;
    const observations = new ObservationsClient(client, "project-1");
    observations.record(call());
    await expect(observations.flush()).resolves.toBeUndefined();
  });

  test("retries a temporary failure", async () => {
    let failures = 1;
    const fake = fakeClient(() => (failures-- > 0 ? 503 : 200));
    const observations = new ObservationsClient(fake.client, "project-1");
    observations.record(call());
    await observations.flush();
    expect([fake.batches.length, fake.attempts()]).toEqual([1, 2]);
  });

  test("a call that does not fit the format does not drop the others", async () => {
    const fake = fakeClient((batch) =>
      batch.some((sent) => sent.observation.conversation_id === "bad")
        ? 400
        : 200,
    );
    const observations = new ObservationsClient(fake.client, "project-1");
    for (const conversationId of ["a", "bad", "b", "c"]) {
      observations.record(call(conversationId));
    }
    await observations.flush();
    const sent = fake.batches
      .flat()
      .map((sent) => sent.observation.conversation_id)
      .sort();
    expect(sent).toEqual(["a", "b", "c"]);
  });

  test("drops calls without retrying when conversations are off", async () => {
    const fake = fakeClient(() => 404);
    const observations = new ObservationsClient(fake.client, "project-1");
    observations.record(call());
    await observations.flush();
    expect(fake.attempts()).toBe(1);
  });

  test("records nothing without a project", async () => {
    const fake = fakeClient();
    const observations = new ObservationsClient(fake.client, null);
    observations.record(call());
    await observations.flush();
    expect(fake.attempts()).toBe(0);
  });

  test("a call that cannot be sent is dropped where it is recorded", async () => {
    const fake = fakeClient();
    const observations = new ObservationsClient(fake.client, "project-1");
    const circular = call() as Observation & { metadata: { self?: unknown } };
    circular.metadata = {};
    circular.metadata.self = circular;
    expect(() => observations.record(circular)).not.toThrow();
    observations.record(call("ticket-2"));
    await observations.flush();
    expect(
      fake.batches.flat().map((sent) => sent.observation.conversation_id),
    ).toEqual(["ticket-2"]);
  });

  test("sends the call as it was when recorded", async () => {
    const fake = fakeClient();
    const observations = new ObservationsClient(fake.client, "project-1");
    const recorded = call();
    observations.record(recorded);
    recorded.conversation_id = "changed";
    await observations.flush();
    expect(fake.batches[0]?.[0]?.observation.conversation_id).toBe("ticket-1");
  });

  test("ignores calls recorded after shutdown", async () => {
    const fake = fakeClient();
    const observations = new ObservationsClient(fake.client, "project-1");
    await observations.shutdown();
    observations.record(call());
    await observations.flush();
    expect(fake.attempts()).toBe(0);
  });
});
