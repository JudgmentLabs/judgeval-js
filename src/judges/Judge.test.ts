import { expect, test } from "bun:test";
import type { Example } from "../data/Example";
import { Judge } from "./Judge";
import type { BinaryResponse } from "./responses";

class ToolUseJudge extends Judge<BinaryResponse> {
  score(_data: Example): Promise<BinaryResponse> {
    this.metric("tool_calls", 3);
    this.metric("tool_calls", 7);
    this.metric("cost_usd", 0.25);
    return Promise.resolve({ value: false, reason: "7 tool calls" });
  }
}

test("metric records the latest number per name on the judge that scored", async () => {
  const judge = new ToolUseJudge();
  const other = new ToolUseJudge();

  await judge.score({} as Example);

  expect(judge.recordedMetrics).toEqual({ tool_calls: 7, cost_usd: 0.25 });
  expect(other.recordedMetrics).toEqual({});
  expect(() => judge.metric("ratio", Number.NaN)).toThrow(RangeError);
});
