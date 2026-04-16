import { describe, expect, test } from "bun:test";
import { immutableWrapAsync } from "./immutable-wrap-async";

function asyncAdd(a: number, b: number): Promise<number> {
  return Promise.resolve(a + b);
}

function asyncExplode(): Promise<never> {
  return Promise.reject(new Error("original error"));
}

describe("immutableWrapAsync", () => {
  test("returns original result with no hooks", async () => {
    const wrapped = immutableWrapAsync(asyncAdd);
    expect(await wrapped(2, 3)).toBe(5);
  });

  test("calls pre hook with args and returns context", async () => {
    const calls: unknown[][] = [];
    const wrapped = immutableWrapAsync(asyncAdd, {
      pre: (a, b) => {
        calls.push([a, b]);
        return { a, b };
      },
    });
    await wrapped(1, 2);
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(1);
    expect(calls[0][1]).toBe(2);
  });

  test("calls post hook with ctx and result", async () => {
    let captured: { token: string; result: number } | undefined;
    const wrapped = immutableWrapAsync(asyncAdd, {
      pre: () => ({ token: "xyz" }),
      post: (ctx, result) => {
        captured = { token: ctx?.token ?? "", result };
        return captured;
      },
    });
    await wrapped(3, 4);
    expect(captured).toBeDefined();
    expect(captured?.result).toBe(7);
    expect(captured?.token).toBe("xyz");
  });

  test("calls error hook on rejection, then re-throws", async () => {
    let capturedError: unknown;
    const wrapped = immutableWrapAsync(asyncExplode, {
      error: (_ctx, err) => {
        capturedError = err;
        return { failed: true };
      },
    });
    try {
      await wrapped();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe("original error");
    }
    expect(capturedError).toBeInstanceOf(Error);
    expect((capturedError as Error).message).toBe("original error");
  });

  test("calls finally hook on success", async () => {
    let finallyCalled = false;
    const wrapped = immutableWrapAsync(asyncAdd, {
      post: () => ({ done: true }),
      finally: (ctx) => {
        finallyCalled = true;
        expect(ctx?.done).toBe(true);
      },
    });
    await wrapped(1, 1);
    expect(finallyCalled).toBe(true);
  });

  test("calls finally hook on error", async () => {
    let finallyCalled = false;
    const wrapped = immutableWrapAsync(asyncExplode, {
      error: () => ({ failed: true }),
      finally: (ctx) => {
        finallyCalled = true;
        expect(ctx?.failed).toBe(true);
      },
    });
    try {
      await wrapped();
    } catch {
      // expected
    }
    expect(finallyCalled).toBe(true);
  });

  test("hook ordering: pre -> fn -> post -> finally on success", async () => {
    const order: string[] = [];
    const fn = (): Promise<number> => {
      order.push("fn");
      return Promise.resolve(1);
    };
    const wrapped = immutableWrapAsync(fn, {
      pre: () => {
        order.push("pre");
        return undefined;
      },
      post: () => {
        order.push("post");
        return undefined;
      },
      finally: () => {
        order.push("finally");
      },
    });
    await wrapped();
    expect(order).toEqual(["pre", "fn", "post", "finally"]);
  });

  test("hook ordering: pre -> fn -> error -> finally on failure", async () => {
    const order: string[] = [];
    const fn = (): Promise<never> => {
      order.push("fn");
      return Promise.reject(new Error("fail"));
    };
    const wrapped = immutableWrapAsync(fn, {
      pre: () => {
        order.push("pre");
        return undefined;
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
      await wrapped();
    } catch {
      // expected
    }
    expect(order).toEqual(["pre", "fn", "error", "finally"]);
  });

  test("context flows from pre to post to finally", async () => {
    let finalCtx: { postResult: number } | undefined;
    const wrapped = immutableWrapAsync(asyncAdd, {
      pre: (a, b) => ({ sum: a + b }),
      post: (ctx, result) => ({ postResult: result + (ctx?.sum ?? 0) }),
      finally: (ctx) => {
        finalCtx = ctx as { postResult: number } | undefined;
      },
    });
    await wrapped(1, 2);
    expect(finalCtx?.postResult).toBe(6);
  });

  test("context flows from pre to error to finally", async () => {
    let finalCtx: { errMsg: string } | undefined;
    const wrapped = immutableWrapAsync(asyncExplode, {
      pre: () => ({ id: "test" }),
      error: (ctx, err) => ({
        errMsg: `${ctx?.id}: ${(err as Error).message}`,
      }),
      finally: (ctx) => {
        finalCtx = ctx as { errMsg: string } | undefined;
      },
    });
    try {
      await wrapped();
    } catch {
      // expected
    }
    expect(finalCtx?.errMsg).toBe("test: original error");
  });

  test("each call gets independent context", async () => {
    const preContexts: { n: number }[] = [];
    const wrapped = immutableWrapAsync(asyncAdd, {
      pre: (a) => {
        const ctx = { n: a };
        preContexts.push(ctx);
        return ctx;
      },
    });
    await wrapped(1, 2);
    await wrapped(3, 4);
    expect(preContexts[0]).not.toBe(preContexts[1]);
    expect(preContexts[0].n).toBe(1);
    expect(preContexts[1].n).toBe(3);
  });

  test("throwing pre hook does not affect function execution", async () => {
    const wrapped = immutableWrapAsync(asyncAdd, {
      pre: () => {
        throw new Error("pre exploded");
      },
    });
    expect(await wrapped(2, 3)).toBe(5);
  });

  test("throwing post hook does not affect return value", async () => {
    const wrapped = immutableWrapAsync(asyncAdd, {
      post: () => {
        throw new Error("post exploded");
      },
    });
    expect(await wrapped(2, 3)).toBe(5);
  });

  test("throwing error hook still re-throws original error", async () => {
    const wrapped = immutableWrapAsync(asyncExplode, {
      error: () => {
        throw new Error("error hook exploded");
      },
    });
    try {
      await wrapped();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as Error).message).toBe("original error");
    }
  });

  test("throwing finally hook does not swallow result", async () => {
    const wrapped = immutableWrapAsync(asyncAdd, {
      finally: () => {
        throw new Error("finally exploded");
      },
    });
    expect(await wrapped(2, 3)).toBe(5);
  });

  test("throwing finally hook does not swallow original error", async () => {
    const wrapped = immutableWrapAsync(asyncExplode, {
      finally: () => {
        throw new Error("finally exploded");
      },
    });
    try {
      await wrapped();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as Error).message).toBe("original error");
    }
  });

  test("post receives args", async () => {
    let capturedArgs: [number, number] | undefined;
    const wrapped = immutableWrapAsync(asyncAdd, {
      post: (_ctx, _result, args) => {
        capturedArgs = args;
        return undefined;
      },
    });
    await wrapped(10, 20);
    expect(capturedArgs).toEqual([10, 20]);
  });
});
