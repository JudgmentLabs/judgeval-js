import { dontThrow } from "../dont-throw";
import type { ImmutableHooks } from "./types";

export function immutableWrapSync<
  A extends unknown[],
  R,
  C1 = undefined,
  C2 = undefined,
  C3 = undefined,
>(
  fn: (...args: A) => R,
  hooks: ImmutableHooks<A, R, C1, C2, C3> = {},
): (...args: A) => R {
  const {
    pre: preFn,
    post: postFn,
    error: errorFn,
    finally: finallyFn,
  } = hooks;

  return function wrapped(...args: A): R {
    const ctx1 = preFn
      ? dontThrow("immutableWrapSync.pre", () => preFn(...args))
      : undefined;

    let finalCtx: C2 | C3 | undefined;
    try {
      const result = fn(...args);
      if (postFn) {
        finalCtx = dontThrow("immutableWrapSync.post", () =>
          postFn(ctx1, result, args),
        );
      }
      return result;
    } catch (err) {
      if (errorFn) {
        finalCtx = dontThrow("immutableWrapSync.error", () =>
          errorFn(ctx1, err, args),
        );
      }
      throw err;
    } finally {
      if (finallyFn) {
        dontThrow("immutableWrapSync.finally", () => {
          finallyFn(finalCtx);
        });
      }
    }
  };
}
