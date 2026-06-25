import { Example } from "../data/Example";

/**
 * A dataset column type: a JSON Schema primitive or the Judgment pointer type
 * `"trace"` (whose stored value is a trace id rather than literal data).
 */
export type DatasetColumnType =
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "trace";

/** A single dataset column declaration. */
export interface DatasetSchemaProperty {
  type: DatasetColumnType;
}

/**
 * A dataset's JSON Schema. Datasets are object-typed with one property per
 * column. A column declared `{ type: "trace" }` (under any name) holds a trace
 * id; at most one trace column is allowed per dataset.
 */
export interface DatasetSchema {
  type: "object";
  properties: Record<string, DatasetSchemaProperty>;
}

const TRACE_TYPE = "trace";

/**
 * Validate a dataset JSON Schema client-side before sending. Mirrors the
 * server's structural checks so obvious mistakes fail fast; the server remains
 * the source of truth for full JSON Schema validation.
 *
 * @throws Error if the schema is not an object, does not declare top-level
 *   `type: "object"`, lacks a `properties` object, or declares more than one
 *   trace-typed column.
 */
export function validateDatasetSchema(schema: unknown): void {
  if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
    throw new Error("Dataset schema must be a JSON object.");
  }
  // Narrowing is now justified by the runtime object-check above.
  const s = schema as Record<string, unknown>;
  if (s.type !== "object") {
    throw new Error('Dataset schema must declare top-level type "object".');
  }
  const properties = s.properties;
  if (
    typeof properties !== "object" ||
    properties === null ||
    Array.isArray(properties)
  ) {
    throw new Error("Dataset schema must declare a 'properties' object.");
  }
  const traceCols = Object.entries(properties as Record<string, unknown>)
    .filter(
      ([, prop]) =>
        typeof prop === "object" &&
        prop !== null &&
        (prop as Record<string, unknown>).type === TRACE_TYPE,
    )
    .map(([name]) => name);
  if (traceCols.length > 1) {
    throw new Error(
      `A dataset may declare at most one trace column; found ${traceCols.length}: ${traceCols.join(", ")}.`,
    );
  }
}

function jsonSchemaType(value: unknown): DatasetColumnType {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object" && value !== null) return "object";
  return "string";
}

/**
 * Infer a JSON Schema from a set of examples. Convenience for
 * `client.datasets.create()` when no explicit schema is supplied. Every
 * example must share the same set of non-null fields; inferred types are JSON
 * Schema primitives only (declare a trace column with an explicit schema).
 *
 * @throws Error if no examples are provided or examples have heterogeneous fields.
 */
export function inferSchemaFromExamples(examples: Example[]): DatasetSchema {
  if (examples.length === 0) {
    throw new Error(
      "Cannot infer a dataset schema without examples. Pass an explicit `schema` to client.datasets.create().",
    );
  }

  const properties: Record<string, DatasetSchemaProperty> = {};
  let allKeys: Set<string> | null = null;

  for (const example of examples) {
    const keys = new Set<string>();
    for (const [key, value] of Object.entries(example.properties)) {
      if (value === null || value === undefined) continue;
      keys.add(key);
      if (!(key in properties)) {
        properties[key] = { type: jsonSchemaType(value) };
      }
    }
    if (allKeys === null) {
      allKeys = keys;
    } else if (
      allKeys.size !== keys.size ||
      ![...allKeys].every((k) => keys.has(k))
    ) {
      throw new Error(
        "All examples must share the same set of fields (dataset schemas require all declared properties). Pass an explicit `schema` or make all examples homogeneous.",
      );
    }
  }

  return { type: "object", properties };
}
