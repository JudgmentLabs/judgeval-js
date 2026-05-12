import { describe, expect, test } from "bun:test";
import { immutableWrapAsyncIterator } from "./immutable-wrap-async-iterator";

async function* asyncNumbers(n: number): AsyncGenerator<number> {
  for (let i = 0; i < n; i++) yield await Promise.resolve(i);
}

async function* asyncExplodingIterator(): AsyncGenerator<number> {
  yield await Promise.resolve(1);
  throw new Error("async iterator error");
}

async function collectAsync<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

describe("immutableWrapAsyncIterator", () => {
  test("yields original values with no hooks", async () => {
    const wrapped = immutableWrapAsyncIterator(asyncNumbers);
    expect(await collectAsync(wrapped(3))).toEqual([0, 1, 2]);
  });

  test("calls pre hook with args and returns context", async () => {
    let capturedN: number | undefined;
    const wrapped = immutableWrapAsyncIterator(asyncNumbers, {
      pre: (n) => {
        capturedN = n;
        return { n };
      },
    });
    await collectAsync(wrapped(5));
    expect(capturedN).toBe(5);
  });

  test("calls yield hook for each yielded value", async () => {
    const values: number[] = [];
    const wrapped = immutableWrapAsyncIterator(asyncNumbers, {
      yield: (_ctx, value) => {
        values.push(value);
      },
    });
    await collectAsync(wrapped(3));
    expect(values).toEqual([0, 1, 2]);
  });

  test("calls post hook on successful completion", async () => {
    let postCalled = false;
    const wrapped = immutableWrapAsyncIterator(asyncNumbers, {
      post: () => {
        postCalled = true;
        return { done: true };
      },
    });
    await collectAsync(wrapped(2));
    expect(postCalled).toBe(true);
  });

  test("calls error hook on iterator error, then re-throws", async () => {
    let capturedError: unknown;
    const wrapped = immutableWrapAsyncIterator(asyncExplodingIterator, {
      error: (_ctx, err) => {
        capturedError = err;
        return { failed: true };
      },
    });
    try {
      await collectAsync(wrapped());
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as Error).message).toBe("async iterator error");
    }
    expect((capturedError as Error).message).toBe("async iterator error");
  });

  test("calls finally hook on success", async () => {
    let finallyCalled = false;
    const wrapped = immutableWrapAsyncIterator(asyncNumbers, {
      post: () => ({ done: true }),
      finally: (ctx) => {
        finallyCalled = true;
        expect(ctx?.done).toBe(true);
      },
    });
    await collectAsync(wrapped(1));
    expect(finallyCalled).toBe(true);
  });

  test("calls finally hook on error", async () => {
    let finallyCalled = false;
    const wrapped = immutableWrapAsyncIterator(asyncExplodingIterator, {
      error: () => ({ failed: true }),
      finally: (ctx) => {
        finallyCalled = true;
        expect(ctx?.failed).toBe(true);
      },
    });
    try {
      await collectAsync(wrapped());
    } catch {
      // expected
    }
    expect(finallyCalled).toBe(true);
  });

  test("hook ordering on success: pre -> yield(s) -> post -> finally", async () => {
    const order: string[] = [];
    const wrapped = immutableWrapAsyncIterator(asyncNumbers, {
      pre: () => {
        order.push("pre");
        return undefined;
      },
      yield: () => {
        order.push("yield");
      },
      post: () => {
        order.push("post");
        return undefined;
      },
      finally: () => {
        order.push("finally");
      },
    });
    await collectAsync(wrapped(2));
    expect(order).toEqual(["pre", "yield", "yield", "post", "finally"]);
  });

  test("hook ordering on error: pre -> yield(s) -> error -> finally", async () => {
    const order: string[] = [];
    const wrapped = immutableWrapAsyncIterator(asyncExplodingIterator, {
      pre: () => {
        order.push("pre");
        return undefined;
      },
      yield: () => {
        order.push("yield");
      },
      error: () => {
        order.push("error");
        return undefined;
      },
      finally: () => {
        order.push("finally");
      },
    });
    try {
      await collectAsync(wrapped());
    } catch {
      // expected
    }
    expect(order).toEqual(["pre", "yield", "error", "finally"]);
  });

  test("context flows from pre to yield", async () => {
    const yieldCtxValues: unknown[] = [];
    const wrapped = immutableWrapAsyncIterator(asyncNumbers, {
      pre: () => ({ id: "shared" }),
      yield: (ctx) => {
        yieldCtxValues.push(ctx?.id);
      },
    });
    await collectAsync(wrapped(2));
    expect(yieldCtxValues).toEqual(["shared", "shared"]);
  });

  test("context flows from pre to post to finally", async () => {
    let finalCtx: { completed: boolean } | undefined;
    const wrapped = immutableWrapAsyncIterator(asyncNumbers, {
      pre: () => ({ id: "test" }),
      post: (ctx) => ({ completed: ctx?.id === "test" }),
      finally: (ctx) => {
        finalCtx = ctx;
      },
    });
    await collectAsync(wrapped(1));
    expect(finalCtx?.completed).toBe(true);
  });

  test("context flows from pre to error to finally", async () => {
    let finalCtx: { errMsg: string } | undefined;
    const wrapped = immutableWrapAsyncIterator(asyncExplodingIterator, {
      pre: () => ({ id: "test" }),
      error: (ctx, err) => ({
        errMsg: `${ctx?.id}: ${(err as Error).message}`,
      }),
      finally: (ctx) => {
        finalCtx = ctx;
      },
    });
    try {
      await collectAsync(wrapped());
    } catch {
      // expected
    }
    expect(finalCtx?.errMsg).toBe("test: async iterator error");
  });

  test("throwing yield hook does not affect yielded values", async () => {
    const wrapped = immutableWrapAsyncIterator(asyncNumbers, {
      yield: () => {
        throw new Error("yield hook exploded");
      },
    });
    expect(await collectAsync(wrapped(3))).toEqual([0, 1, 2]);
  });

  test("throwing pre hook does not affect iteration", async () => {
    const wrapped = immutableWrapAsyncIterator(asyncNumbers, {
      pre: () => {
        throw new Error("pre exploded");
      },
    });
    expect(await collectAsync(wrapped(2))).toEqual([0, 1]);
  });
});
