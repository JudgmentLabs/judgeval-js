import { describe, expect, test } from "bun:test";
import { pLimit } from "./p-limit";
import { sleep } from "./sleep";

describe("pLimit", () => {
  test("caps in-flight calls at the limit", async () => {
    const limit = pLimit(3);
    let inFlight = 0;
    let maxInFlight = 0;

    const results = await Promise.all(
      [0, 1, 2, 3, 4, 5, 6, 7].map((n) =>
        limit(async () => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await sleep(5);
          inFlight -= 1;
          return n;
        }),
      ),
    );

    expect(maxInFlight).toBe(3);
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  test("concurrency 1 runs sequentially in call order", async () => {
    const limit = pLimit(1);
    const order: number[] = [];

    await Promise.all(
      [0, 1, 2, 3].map((n) =>
        limit(async () => {
          order.push(n);
          await sleep(5 - n);
          order.push(n);
        }),
      ),
    );

    expect(order).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  test("a rejection propagates without blocking queued tasks", async () => {
    const limit = pLimit(1);
    const failing = limit(() => Promise.reject(new Error("boom")));
    const following = limit(() => "ok");

    await expect(failing).rejects.toThrow("boom");
    expect(await following).toBe("ok");
  });

  test("rejects invalid concurrency", () => {
    expect(() => pLimit(0)).toThrow(TypeError);
    expect(() => pLimit(1.5)).toThrow(TypeError);
  });
});
