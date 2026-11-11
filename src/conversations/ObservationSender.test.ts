import { describe, expect, test } from "bun:test";
import type { JudgmentApiClient } from "../internal/api/client";
import type { Observation } from "../internal/api/models";
import { ObservationSender } from "./ObservationSender";

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

const now = new Date("2026-09-25T12:00:01Z");

describe("ObservationSender", () => {
  test("sends a call with its time and the configured environment", async () => {
    const fake = fakeClient();
    const sender = new ObservationSender(
      fake.client,
      "project-1",
      "production",
    );
    sender.enqueue(call(), now);
    await sender.flush();
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
    const sender = new ObservationSender(fake.client, "project-1", undefined);
    for (let index = 0; index < 250; index++) {
      sender.enqueue(call("ticket-1", String(index)), now);
    }
    await sender.flush();
    expect(fake.batches.map((batch) => batch.length)).toEqual([100, 100, 50]);
  });

  test("a send failure never reaches the caller", async () => {
    const client = {
      postV1projectsObservations: () =>
        Promise.reject(new Error("network down")),
    } as unknown as JudgmentApiClient;
    const sender = new ObservationSender(client, "project-1", undefined);
    sender.enqueue(call(), now);
    await expect(sender.flush()).resolves.toBeUndefined();
  });

  test("retries a temporary failure", async () => {
    let failures = 1;
    const fake = fakeClient(() => (failures-- > 0 ? 503 : 200));
    const sender = new ObservationSender(fake.client, "project-1", undefined);
    sender.enqueue(call(), now);
    await sender.flush();
    expect([fake.batches.length, fake.attempts()]).toEqual([1, 2]);
  });

  test("a call that does not fit the format does not drop the others", async () => {
    const fake = fakeClient((batch) =>
      batch.some((sent) => sent.observation.conversation_id === "bad")
        ? 400
        : 200,
    );
    const sender = new ObservationSender(fake.client, "project-1", undefined);
    for (const conversationId of ["a", "bad", "b", "c"]) {
      sender.enqueue(call(conversationId), now);
    }
    await sender.flush();
    const sent = fake.batches
      .flat()
      .map((sent) => sent.observation.conversation_id)
      .sort();
    expect(sent).toEqual(["a", "b", "c"]);
  });

  for (const status of [402, 404]) {
    test(`drops calls without retrying on ${status}`, async () => {
      const fake = fakeClient(() => status);
      const sender = new ObservationSender(fake.client, "project-1", undefined);
      sender.enqueue(call(), now);
      await sender.flush();
      expect(fake.attempts()).toBe(1);
    });
  }

  test("sends nothing when recording is off", async () => {
    const fake = fakeClient();
    const sender = new ObservationSender(null, null, undefined);
    sender.enqueue(call(), now);
    await sender.flush();
    expect(fake.attempts()).toBe(0);
  });

  test("sends the call as it was when recorded", async () => {
    const fake = fakeClient();
    const sender = new ObservationSender(fake.client, "project-1", undefined);
    const recorded = call();
    sender.enqueue(recorded, now);
    recorded.conversation_id = "changed";
    await sender.flush();
    expect(fake.batches[0]?.[0]?.observation.conversation_id).toBe("ticket-1");
  });

  test("ignores calls queued after it stops", async () => {
    const fake = fakeClient();
    const sender = new ObservationSender(fake.client, "project-1", undefined);
    await sender.stop();
    sender.enqueue(call(), now);
    await sender.flush();
    expect(fake.attempts()).toBe(0);
  });
});
