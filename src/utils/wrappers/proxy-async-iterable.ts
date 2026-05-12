import { immutableWrapAsyncIterator } from "./immutable-wrap-async-iterator";

/**
 * Replace `[Symbol.asyncIterator]` on `target` in place, intercepting
 * yielded values and lifecycle events through hooks. The target object
 * is mutated so that other properties (e.g. `.controller`, `.tee()`)
 * remain intact.
 */
export function proxyAsyncIterable<T>(
  target: AsyncIterable<T>,
  hooks: {
    onYield: (value: T) => void;
    onDone: () => void;
    onError: (err: unknown) => void;
    onFinally: () => void;
  },
): void {
  const original = target[Symbol.asyncIterator].bind(target);

  const wrapped = immutableWrapAsyncIterator(
    () => ({ [Symbol.asyncIterator]: original }) as AsyncIterable<T>,
    {
      yield: (_ctx, value) => {
        hooks.onYield(value);
      },
      post: () => {
        hooks.onDone();
      },
      error: (_ctx, err) => {
        hooks.onError(err);
      },
      finally: () => {
        hooks.onFinally();
      },
    },
  );

  (target as unknown as { [Symbol.asyncIterator]: () => AsyncIterator<T> })[
    Symbol.asyncIterator
  ] = () => wrapped();
}
