import { dontThrow } from "../dont-throw";
import type { ImmutableHooks } from "./types";

export function immutableWrapAsync<
  A extends unknown[],
  R,
  C1 = undefined,
  C2 = undefined,
  C3 = undefined,
>(
  fn: (...args: A) => Promise<R>,
  hooks: ImmutableHooks<A, R, C1, C2, C3> = {},
): (...args: A) => Promise<R> {
  const {
    pre: preFn,
    post: postFn,
    error: errorFn,
    finally: finallyFn,
  } = hooks;

  return async function wrapped(...args: A): Promise<R> {
    const ctx1 = preFn
      ? dontThrow("immutableWrapAsync.pre", () => preFn(...args))
      : undefined;

    let finalCtx: C2 | C3 | undefined;
    try {
      const result = await fn(...args);
      if (postFn) {
        finalCtx = dontThrow("immutableWrapAsync.post", () =>
          postFn(ctx1, result, args),
        );
      }
      return result;
    } catch (err) {
      if (errorFn) {
        finalCtx = dontThrow("immutableWrapAsync.error", () =>
          errorFn(ctx1, err, args),
        );
      }
      throw err;
    } finally {
      if (finallyFn) {
        dontThrow("immutableWrapAsync.finally", () => {
          finallyFn(finalCtx);
        });
      }
    }
  };
}
