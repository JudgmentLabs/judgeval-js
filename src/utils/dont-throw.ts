import { Logger } from "./logger";

/**
 * Run `fn` and swallow any thrown error, logging it instead.
 *
 * Used to wrap bodies of tracer methods that touch external state so
 * they can never crash user code. Mirrors Python's `dont_throw`
 * decorator in `judgeval.utils.decorators.dont_throw`.
 *
 * @param name - Name used in the error log (typically `"ClassName.method"`).
 * @param fn - Function to invoke.
 * @param fallback - Optional value returned when `fn` throws.
 * @returns The return value of `fn`, or `fallback` (or `undefined`) on error.
 *
 * @example
 * ```typescript
 * static asyncEvaluate(judge: string): void {
 *   dontThrow("BaseTracer.asyncEvaluate", () => {
 *     // ... logic that might throw ...
 *   });
 * }
 * ```
 */
export function dontThrow<T>(name: string, fn: () => T): T | undefined;
export function dontThrow<T>(name: string, fn: () => T, fallback: T): T;
export function dontThrow<T>(
  name: string,
  fn: () => T,
  fallback?: T,
): T | undefined {
  try {
    return fn();
  } catch (err) {
    const stack = err instanceof Error && err.stack ? `\n${err.stack}` : "";
    Logger.error(
      `[Caught] An exception was raised in ${name}: ${String(err)}${stack}`,
    );
    return fallback;
  }
}
