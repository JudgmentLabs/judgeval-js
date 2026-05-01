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
export class Example {
  readonly exampleId: string;
  readonly createdAt: string;
  readonly name: string | null;
  private readonly _properties: Record<string, unknown>;

  private constructor(
    exampleId: string,
    createdAt: string,
    name: string | null,
    properties: Record<string, unknown>,
  ) {
    this.exampleId = exampleId;
    this.createdAt = createdAt;
    this.name = name;
    this._properties = properties;
  }

  /**
   * Create an example with the given properties.
   *
   * Any key-value pairs passed in `props` become accessible via `.get()`.
   * Common keys: `input`, `actual_output`, `expected_output`, `retrieval_context`.
   */
  static create(props: Record<string, unknown> = {}): Example {
    return new Example(crypto.randomUUID(), new Date().toISOString(), null, {
      ...props,
    });
  }

  /** Known keys on the API Example interface that are not user properties. */
  private static readonly META_KEYS = new Set([
    "example_id",
    "created_at",
    "name",
    "trace_id",
    "span_id",
  ]);

  /**
   * Reconstruct an Example from an API response dict.
   *
   * Separates the fixed metadata fields (`example_id`, `created_at`, `name`)
   * from user-defined properties.
   */
  static from(data: ExampleDict): Example {
    const properties: Record<string, unknown> = {};
    for (const key of Object.keys(data)) {
      if (!Example.META_KEYS.has(key)) {
        properties[key] = (data as Record<string, unknown>)[key];
      }
    }
    return new Example(
      data.example_id ?? "",
      data.created_at ?? "",
      data.name ?? null,
      properties,
    );
  }

  /** Get a property by key. */
  get(key: string): unknown {
    return this._properties[key];
  }

  /** Check if a property key exists. */
  has(key: string): boolean {
    return key in this._properties;
  }

  /** Return a shallow copy of all custom properties. */
  get properties(): Record<string, unknown> {
    return { ...this._properties };
  }

  /** Serialize to the API wire format. */
  toJSON(): ExampleDict {
    const result: Record<string, unknown> = {
      example_id: this.exampleId,
      created_at: this.createdAt,
      name: this.name,
    };
    for (const [key, value] of Object.entries(this._properties)) {
      result[key] = value;
    }
    // result satisfies ExampleDict structurally — example_id and created_at
    // are always present strings, plus arbitrary extra keys.
    return result as ExampleDict;
  }
}
