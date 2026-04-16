import { dontThrow } from "../dont-throw";
import type { ImmutableIteratorHooks } from "./types";

export function immutableWrapAsyncIterator<
  A extends unknown[],
  Y,
  C1 = undefined,
  C2 = undefined,
  C3 = undefined,
>(
  fn: (...args: A) => AsyncIterable<Y>,
  hooks: ImmutableIteratorHooks<A, Y, C1, C2, C3> = {},
): (...args: A) => AsyncGenerator<Y> {
  const {
    pre: preFn,
    yield: yieldFn,
    post: postFn,
    error: errorFn,
    finally: finallyFn,
  } = hooks;

  return async function* wrapped(...args: A): AsyncGenerator<Y> {
    const ctx1 = preFn
      ? dontThrow("immutableWrapAsyncIterator.pre", () => preFn(...args))
      : undefined;

    let finalCtx: C2 | C3 | undefined;
    try {
      for await (const value of fn(...args)) {
        if (yieldFn) {
          dontThrow("immutableWrapAsyncIterator.yield", () => {
            yieldFn(ctx1, value);
          });
        }
        yield value;
      }
      if (postFn) {
        finalCtx = dontThrow("immutableWrapAsyncIterator.post", () =>
          postFn(ctx1),
        );
      }
    } catch (err) {
      if (errorFn) {
        finalCtx = dontThrow("immutableWrapAsyncIterator.error", () =>
          errorFn(ctx1, err),
        );
      }
      throw err;
    } finally {
      if (finallyFn) {
        dontThrow("immutableWrapAsyncIterator.finally", () => {
          finallyFn(finalCtx);
        });
      }
    }
  };
}
