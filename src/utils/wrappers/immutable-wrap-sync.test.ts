import { describe, expect, test } from "bun:test";
import { immutableWrapSync } from "./immutable-wrap-sync";

function add(a: number, b: number): number {
  return a + b;
}

function explode(): never {
  throw new Error("original error");
}

describe("immutableWrapSync", () => {
  test("returns original result with no hooks", () => {
    const wrapped = immutableWrapSync(add);
    expect(wrapped(2, 3)).toBe(5);
  });

  test("calls pre hook with args and returns context", () => {
    const calls: unknown[][] = [];
    const wrapped = immutableWrapSync(add, {
      pre: (a, b) => {
        calls.push([a, b]);
        return { a, b };
      },
    });
    wrapped(1, 2);
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(1);
    expect(calls[0][1]).toBe(2);
  });

  test("calls post hook with ctx and result", () => {
    let captured: { token: string; result: number } | undefined;
    const wrapped = immutableWrapSync(add, {
      pre: () => ({ token: "abc" }),
      post: (ctx, result) => {
        captured = { token: ctx?.token ?? "", result };
        return captured;
      },
    });
    wrapped(3, 4);
    expect(captured).toBeDefined();
    expect(captured?.result).toBe(7);
    expect(captured?.token).toBe("abc");
  });

  test("calls error hook on throw, then re-throws", () => {
    let capturedError: unknown;
    const wrapped = immutableWrapSync(explode, {
      error: (_ctx, err) => {
        capturedError = err;
        return { failed: true };
      },
    });
    expect(() => wrapped()).toThrow("original error");
    expect(capturedError).toBeInstanceOf(Error);
    expect((capturedError as Error).message).toBe("original error");
  });

  test("calls finally hook on success", () => {
    let finallyCalled = false;
    const wrapped = immutableWrapSync(add, {
      post: () => ({ done: true }),
      finally: (ctx) => {
        finallyCalled = true;
        expect(ctx?.done).toBe(true);
      },
    });
    wrapped(1, 1);
    expect(finallyCalled).toBe(true);
  });

  test("calls finally hook on error", () => {
    let finallyCalled = false;
    const wrapped = immutableWrapSync(explode, {
      error: () => ({ failed: true }),
      finally: (ctx) => {
        finallyCalled = true;
        expect(ctx?.failed).toBe(true);
      },
    });
    expect(() => wrapped()).toThrow();
    expect(finallyCalled).toBe(true);
  });

  test("hook ordering: pre -> fn -> post -> finally on success", () => {
    const order: string[] = [];
    const fn = () => {
      order.push("fn");
      return 1;
    };
    const wrapped = immutableWrapSync(fn, {
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
    wrapped();
    expect(order).toEqual(["pre", "fn", "post", "finally"]);
  });

  test("hook ordering: pre -> fn -> error -> finally on failure", () => {
    const order: string[] = [];
    const fn = (): never => {
      order.push("fn");
      throw new Error("fail");
    };
    const wrapped = immutableWrapSync(fn, {
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
    expect(() => wrapped()).toThrow();
    expect(order).toEqual(["pre", "fn", "error", "finally"]);
  });

  test("context flows from pre to post to finally", () => {
    let finalCtx: { postResult: number } | undefined;
    const wrapped = immutableWrapSync(add, {
      pre: (a, b) => ({ sum: a + b }),
      post: (ctx, result) => ({ postResult: result + (ctx?.sum ?? 0) }),
      finally: (ctx) => {
        finalCtx = ctx;
      },
    });
    wrapped(1, 2);
    expect(finalCtx?.postResult).toBe(6); // result(3) + ctx.sum(3)
  });

  test("context flows from pre to error to finally", () => {
    let finalCtx: { errMsg: string } | undefined;
    const wrapped = immutableWrapSync(explode, {
      pre: () => ({ id: "test" }),
      error: (ctx, err) => ({
        errMsg: `${ctx?.id}: ${(err as Error).message}`,
      }),
      finally: (ctx) => {
        finalCtx = ctx;
      },
    });
    expect(() => wrapped()).toThrow();
    expect(finalCtx?.errMsg).toBe("test: original error");
  });

  test("each call gets independent context", () => {
    const preContexts: { n: number }[] = [];
    const wrapped = immutableWrapSync(add, {
      pre: (a) => {
        const ctx = { n: a };
        preContexts.push(ctx);
        return ctx;
      },
    });
    wrapped(1, 2);
    wrapped(3, 4);
    expect(preContexts[0]).not.toBe(preContexts[1]);
    expect(preContexts[0].n).toBe(1);
    expect(preContexts[1].n).toBe(3);
  });

  test("throwing pre hook does not affect function execution", () => {
    const wrapped = immutableWrapSync(add, {
      pre: () => {
        throw new Error("pre exploded");
      },
    });
    expect(wrapped(2, 3)).toBe(5);
  });

  test("throwing post hook does not affect return value", () => {
    const wrapped = immutableWrapSync(add, {
      post: () => {
        throw new Error("post exploded");
      },
    });
    expect(wrapped(2, 3)).toBe(5);
  });

  test("throwing error hook still re-throws original error", () => {
    const wrapped = immutableWrapSync(explode, {
      error: () => {
        throw new Error("error hook exploded");
      },
    });
    expect(() => wrapped()).toThrow("original error");
  });

  test("throwing finally hook does not swallow result", () => {
    const wrapped = immutableWrapSync(add, {
      finally: () => {
        throw new Error("finally exploded");
      },
    });
    expect(wrapped(2, 3)).toBe(5);
  });

  test("throwing finally hook does not swallow original error", () => {
    const wrapped = immutableWrapSync(explode, {
      finally: () => {
        throw new Error("finally exploded");
      },
    });
    expect(() => wrapped()).toThrow("original error");
  });

  test("post receives args", () => {
    let capturedArgs: [number, number] | undefined;
    const wrapped = immutableWrapSync(add, {
      post: (_ctx, _result, args) => {
        capturedArgs = args;
        return undefined;
      },
    });
    wrapped(10, 20);
    expect(capturedArgs).toEqual([10, 20]);
  });
});
