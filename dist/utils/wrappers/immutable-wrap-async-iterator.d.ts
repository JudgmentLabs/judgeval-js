import type { ImmutableIteratorHooks } from "./types";
export declare function immutableWrapAsyncIterator<A extends unknown[], Y, C1 = undefined, C2 = undefined, C3 = undefined>(fn: (...args: A) => AsyncIterable<Y>, hooks?: ImmutableIteratorHooks<A, Y, C1, C2, C3>): (...args: A) => AsyncGenerator<Y>;
//# sourceMappingURL=immutable-wrap-async-iterator.d.ts.map