export type AsyncFn = (...args: any[]) => Promise<any>;
export interface ImmutableHooks<A extends unknown[], R, C1 = undefined, C2 = undefined, C3 = undefined> {
    pre?: (...args: A) => C1;
    post?: (ctx: C1 | undefined, result: R, args: A) => C2;
    error?: (ctx: C1 | undefined, error: unknown, args: A) => C3;
    finally?: (ctx: C2 | C3 | undefined) => void;
}
export interface ImmutableIteratorHooks<A extends unknown[], Y, C1 = undefined, C2 = undefined, C3 = undefined> {
    pre?: (...args: A) => C1;
    yield?: (ctx: C1 | undefined, value: Y) => void;
    post?: (ctx: C1 | undefined) => C2;
    error?: (ctx: C1 | undefined, error: unknown) => C3;
    finally?: (ctx: C2 | C3 | undefined) => void;
}
//# sourceMappingURL=types.d.ts.map