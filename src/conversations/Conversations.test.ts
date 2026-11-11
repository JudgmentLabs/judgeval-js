import { describe, expect, test } from "bun:test";
import { Conversations } from "./Conversations";

const call = {
  conversation_id: "ticket-1",
  input: [
    {
      type: "message" as const,
      role: "user" as const,
      content: [{ type: "text" as const, text: "Hi" }],
    },
  ],
};

describe("Conversations", () => {
  test("recording before init does nothing and never throws", async () => {
    expect(() => Conversations.record(call)).not.toThrow();
    await expect(Conversations.flush()).resolves.toBeUndefined();
  });

  test("init without credentials leaves recording off and never rejects", async () => {
    await expect(
      Conversations.init({
        projectName: "support-bot",
        apiKey: "",
        organizationId: "",
        apiUrl: "",
      }),
    ).resolves.toBeUndefined();
    expect(() => Conversations.record(call)).not.toThrow();
    await expect(Conversations.shutdown()).resolves.toBeUndefined();
  });
});
