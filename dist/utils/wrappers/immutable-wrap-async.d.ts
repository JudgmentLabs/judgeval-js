import type { AsyncFn, ImmutableHooks } from "./types";
export declare function immutableWrapAsync<F extends AsyncFn, C1 = undefined, C2 = undefined, C3 = undefined>(fn: F, hooks?: ImmutableHooks<Parameters<F>, Awaited<ReturnType<F>>, C1, C2, C3>): F;
//# sourceMappingURL=immutable-wrap-async.d.ts.map