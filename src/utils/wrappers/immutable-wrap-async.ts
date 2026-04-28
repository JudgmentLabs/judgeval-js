import { dontThrow } from "../dont-throw";
import type { AsyncFn, ImmutableHooks } from "./types";

export function immutableWrapAsync<
  F extends AsyncFn,
  C1 = undefined,
  C2 = undefined,
  C3 = undefined,
>(
  fn: F,
  hooks: ImmutableHooks<Parameters<F>, Awaited<ReturnType<F>>, C1, C2, C3> = {},
): F {
  const {
    pre: preFn,
    post: postFn,
    error: errorFn,
    finally: finallyFn,
  } = hooks;

  return async function wrapped(
    this: unknown,
    ...args: Parameters<F>
  ): Promise<Awaited<ReturnType<F>>> {
    const ctx1 = preFn
      ? dontThrow("immutableWrapAsync.pre", () => preFn(...args))
      : undefined;

    let finalCtx: C2 | C3 | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result: Awaited<ReturnType<F>> = await fn.apply(this, args);
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
  } as F;
}
