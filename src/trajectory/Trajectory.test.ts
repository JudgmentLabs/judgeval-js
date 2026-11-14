import { describe, expect, test } from "bun:test";
import { Trajectory } from "./Trajectory";

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

describe("Trajectory", () => {
  test("recording before init does nothing and never throws", async () => {
    expect(() => Trajectory.record(call)).not.toThrow();
    await expect(Trajectory.flush()).resolves.toBeUndefined();
  });

  test("init without credentials leaves recording off and never rejects", async () => {
    await expect(
      Trajectory.init({
        projectName: "support-bot",
        apiKey: "",
        organizationId: "",
        apiUrl: "",
      }),
    ).resolves.toBeUndefined();
    expect(() => Trajectory.record(call)).not.toThrow();
    await expect(Trajectory.shutdown()).resolves.toBeUndefined();
  });
});
