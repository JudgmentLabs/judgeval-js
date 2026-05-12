import { describe, expect, test } from "bun:test";
import { immutableWrapSyncIterator } from "./immutable-wrap-sync-iterator";

function* numbers(n: number): Generator<number> {
  for (let i = 0; i < n; i++) yield i;
}

function* explodingIterator(): Generator<number> {
  yield 1;
  throw new Error("iterator error");
}

function collect<T>(gen: Iterable<T>): T[] {
  const out: T[] = [];
  for (const v of gen) out.push(v);
  return out;
}

describe("immutableWrapSyncIterator", () => {
  test("yields original values with no hooks", () => {
    const wrapped = immutableWrapSyncIterator(numbers);
    expect(collect(wrapped(3))).toEqual([0, 1, 2]);
  });

  test("calls pre hook with args and returns context", () => {
    let capturedN: number | undefined;
    const wrapped = immutableWrapSyncIterator(numbers, {
      pre: (n) => {
        capturedN = n;
        return { n };
      },
    });
    collect(wrapped(5));
    expect(capturedN).toBe(5);
  });

  test("calls yield hook for each yielded value", () => {
    const values: number[] = [];
    const wrapped = immutableWrapSyncIterator(numbers, {
      yield: (_ctx, value) => {
        values.push(value);
      },
    });
    collect(wrapped(3));
    expect(values).toEqual([0, 1, 2]);
  });

  test("calls post hook on successful completion", () => {
    let postCalled = false;
    const wrapped = immutableWrapSyncIterator(numbers, {
      post: () => {
        postCalled = true;
        return { done: true };
      },
    });
    collect(wrapped(2));
    expect(postCalled).toBe(true);
  });

  test("calls error hook on iterator error, then re-throws", () => {
    let capturedError: unknown;
    const wrapped = immutableWrapSyncIterator(explodingIterator, {
      error: (_ctx, err) => {
        capturedError = err;
        return { failed: true };
      },
    });
    expect(() => collect(wrapped())).toThrow("iterator error");
    expect((capturedError as Error).message).toBe("iterator error");
  });

  test("calls finally hook on success", () => {
    let finallyCalled = false;
    const wrapped = immutableWrapSyncIterator(numbers, {
      post: () => ({ done: true }),
      finally: (ctx) => {
        finallyCalled = true;
        expect(ctx?.done).toBe(true);
      },
    });
    collect(wrapped(1));
    expect(finallyCalled).toBe(true);
  });

  test("calls finally hook on error", () => {
    let finallyCalled = false;
    const wrapped = immutableWrapSyncIterator(explodingIterator, {
      error: () => ({ failed: true }),
      finally: (ctx) => {
        finallyCalled = true;
        expect(ctx?.failed).toBe(true);
      },
    });
    expect(() => collect(wrapped())).toThrow();
    expect(finallyCalled).toBe(true);
  });

  test("hook ordering on success: pre -> yield(s) -> post -> finally", () => {
    const order: string[] = [];
    const wrapped = immutableWrapSyncIterator(numbers, {
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
    collect(wrapped(2));
    expect(order).toEqual(["pre", "yield", "yield", "post", "finally"]);
  });

  test("hook ordering on error: pre -> yield(s) -> error -> finally", () => {
    const order: string[] = [];
    const wrapped = immutableWrapSyncIterator(explodingIterator, {
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
    expect(() => collect(wrapped())).toThrow();
    expect(order).toEqual(["pre", "yield", "error", "finally"]);
  });

  test("context flows from pre to yield", () => {
    const yieldCtxValues: unknown[] = [];
    const wrapped = immutableWrapSyncIterator(numbers, {
      pre: () => ({ id: "shared" }),
      yield: (ctx) => {
        yieldCtxValues.push(ctx?.id);
      },
    });
    collect(wrapped(2));
    expect(yieldCtxValues).toEqual(["shared", "shared"]);
  });

  test("context flows from pre to post to finally", () => {
    let finalCtx: { completed: boolean } | undefined;
    const wrapped = immutableWrapSyncIterator(numbers, {
      pre: () => ({ id: "test" }),
      post: (ctx) => ({ completed: ctx?.id === "test" }),
      finally: (ctx) => {
        finalCtx = ctx;
      },
    });
    collect(wrapped(1));
    expect(finalCtx?.completed).toBe(true);
  });

  test("context flows from pre to error to finally", () => {
    let finalCtx: { errMsg: string } | undefined;
    const wrapped = immutableWrapSyncIterator(explodingIterator, {
      pre: () => ({ id: "test" }),
      error: (ctx, err) => ({
        errMsg: `${ctx?.id}: ${(err as Error).message}`,
      }),
      finally: (ctx) => {
        finalCtx = ctx;
      },
    });
    expect(() => collect(wrapped())).toThrow();
    expect(finalCtx?.errMsg).toBe("test: iterator error");
  });

  test("throwing yield hook does not affect yielded values", () => {
    const wrapped = immutableWrapSyncIterator(numbers, {
      yield: () => {
        throw new Error("yield hook exploded");
      },
    });
    expect(collect(wrapped(3))).toEqual([0, 1, 2]);
  });

  test("throwing pre hook does not affect iteration", () => {
    const wrapped = immutableWrapSyncIterator(numbers, {
      pre: () => {
        throw new Error("pre exploded");
      },
    });
    expect(collect(wrapped(2))).toEqual([0, 1]);
  });
});
