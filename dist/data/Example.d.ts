import type { Example as APIExample } from "../internal/api/models/Example";
/**
 * The wire format for examples: the fixed API fields plus arbitrary
 * user-defined properties (input, actual_output, etc.).
 */
export type ExampleDict = APIExample & Record<string, unknown>;
/**
 * A single evaluation example with flexible key-value properties.
 *
 * Use `Example.create()` to construct an example with arbitrary fields
 * such as `input`, `actualOutput`, `expectedOutput`, etc.
 *
 * @example
 * ```typescript
 * const example = Example.create({
 *   input: "What is the capital of France?",
 *   actual_output: "Paris is the capital of France.",
 *   expected_output: "Paris",
 * });
 *
 * example.get("input"); // "What is the capital of France?"
 * ```
 */
export declare class Example {
    readonly exampleId: string;
    readonly createdAt: string;
    readonly name: string | null;
    private readonly _properties;
    private constructor();
    /**
     * Create an example with the given properties.
     *
     * Any key-value pairs passed in `props` become accessible via `.get()`.
     * Common keys: `input`, `actual_output`, `expected_output`, `retrieval_context`.
     */
    static create(props?: Record<string, unknown>): Example;
    /** Known keys on the API Example interface that are not user properties. */
    private static readonly META_KEYS;
    /**
     * Reconstruct an Example from an API response dict.
     *
     * Separates the fixed metadata fields (`example_id`, `created_at`, `name`)
     * from user-defined properties.
     */
    static from(data: ExampleDict): Example;
    /** Get a property by key. */
    get(key: string): unknown;
    /** Check if a property key exists. */
    has(key: string): boolean;
    /** Return a shallow copy of all custom properties. */
    get properties(): Record<string, unknown>;
    /** Serialize to the API wire format. */
    toJSON(): ExampleDict;
}
//# sourceMappingURL=Example.d.ts.map