/**
 * Replace `[Symbol.asyncIterator]` on `target` in place, intercepting
 * yielded values and lifecycle events through hooks. The target object
 * is mutated so that other properties (e.g. `.controller`, `.tee()`)
 * remain intact.
 */
export declare function proxyAsyncIterable<T>(target: AsyncIterable<T>, hooks: {
    onYield: (value: T) => void;
    onDone: () => void;
    onError: (err: unknown) => void;
    onFinally: () => void;
}): void;
//# sourceMappingURL=proxy-async-iterable.d.ts.map