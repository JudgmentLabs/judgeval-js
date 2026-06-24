import type { ImmutableIteratorHooks } from "./types";
export declare function immutableWrapSyncIterator<A extends unknown[], Y, C1 = undefined, C2 = undefined, C3 = undefined>(fn: (...args: A) => Iterable<Y>, hooks?: ImmutableIteratorHooks<A, Y, C1, C2, C3>): (...args: A) => Generator<Y>;
//# sourceMappingURL=immutable-wrap-sync-iterator.d.ts.map