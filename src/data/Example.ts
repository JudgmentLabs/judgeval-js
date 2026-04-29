import type { Example as APIExample } from "../internal/api/models/Example";

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
    exampleId?: string,
    createdAt?: string,
    name?: string | null,
    properties?: Record<string, unknown>,
  ) {
    this.exampleId = exampleId ?? crypto.randomUUID();
    this.createdAt = createdAt ?? new Date().toISOString();
    this.name = name ?? null;
    this._properties = properties ?? {};
  }

  /**
   * Create an example with the given properties.
   *
   * Any key-value pairs passed in `props` become accessible via `.get()`.
   * Common keys: `input`, `actual_output`, `expected_output`, `retrieval_context`.
   */
  static create(props: Record<string, unknown> = {}): Example {
    return new Example(undefined, undefined, undefined, { ...props });
  }

  /**
   * Reconstruct an Example from a raw API/dataset dict (snake_case keys).
   * Used when pulling examples from a dataset or API response.
   */
  static fromDict(data: Record<string, unknown>): Example {
    const exampleId = (data.example_id as string) ?? "";
    const createdAt = (data.created_at as string) ?? "";
    const name = (data.name as string | null) ?? null;

    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key !== "example_id" && key !== "created_at" && key !== "name") {
        properties[key] = value;
      }
    }

    return new Example(exampleId, createdAt, name, properties);
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
  toDict(): APIExample & Record<string, unknown> {
    const result: Record<string, unknown> = {
      example_id: this.exampleId,
      created_at: this.createdAt,
      name: this.name,
    };
    for (const [key, value] of Object.entries(this._properties)) {
      result[key] = value;
    }
    return result as APIExample & Record<string, unknown>;
  }
}
