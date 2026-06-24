/**
 * Run `fn` and swallow any thrown error, logging it instead.
 *
 * @param name - Name used in the error log (typically `"ClassName.method"`).
 * @param fn - Function to invoke.
 * @param fallback - Optional value returned when `fn` throws.
 * @returns The return value of `fn`, or `fallback` (or `undefined`) on error.
 */
export declare function dontThrow<T>(name: string, fn: () => T): T | undefined;
export declare function dontThrow<T>(name: string, fn: () => T, fallback: T): T;
//# sourceMappingURL=dont-throw.d.ts.map