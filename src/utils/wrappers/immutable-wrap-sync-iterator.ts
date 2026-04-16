import { dontThrow } from "../dont-throw";
import type { ImmutableIteratorHooks } from "./types";

export function immutableWrapSyncIterator<
  A extends unknown[],
  Y,
  C1 = undefined,
  C2 = undefined,
  C3 = undefined,
>(
  fn: (...args: A) => Iterable<Y>,
  hooks: ImmutableIteratorHooks<A, Y, C1, C2, C3> = {},
): (...args: A) => Generator<Y> {
  const {
    pre: preFn,
    yield: yieldFn,
    post: postFn,
    error: errorFn,
    finally: finallyFn,
  } = hooks;

  return function* wrapped(...args: A): Generator<Y> {
    const ctx1 = preFn
      ? dontThrow("immutableWrapSyncIterator.pre", () => preFn(...args))
      : undefined;

    let finalCtx: C2 | C3 | undefined;
    try {
      for (const value of fn(...args)) {
        if (yieldFn) {
          dontThrow("immutableWrapSyncIterator.yield", () => {
            yieldFn(ctx1, value);
          });
        }
        yield value;
      }
      if (postFn) {
        finalCtx = dontThrow("immutableWrapSyncIterator.post", () =>
          postFn(ctx1),
        );
      }
    } catch (err) {
      if (errorFn) {
        finalCtx = dontThrow("immutableWrapSyncIterator.error", () =>
          errorFn(ctx1, err),
        );
      }
      throw err;
    } finally {
      if (finallyFn) {
        dontThrow("immutableWrapSyncIterator.finally", () => {
          finallyFn(finalCtx);
        });
      }
    }
  };
}
