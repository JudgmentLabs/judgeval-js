/**
 * Links a score back to a specific span in a trace, enabling
 * drill-down from evaluation results into the traced execution.
 */
export interface Citation {
  /** The span ID this citation refers to. */
  spanId: string;
  /** The span attribute (e.g. `"input"`, `"output"`) being cited. */
  spanAttribute: string;
}

/**
 * Base fields shared by all scorer response types.
 *
 * Custom judges return one of the concrete subtypes
 * (`BinaryResponse`, `NumericResponse`, or `CategoricalResponse`)
 * from their `score()` method.
 */
export interface BaseResponse {
  /** The score value. Type depends on the concrete response type. */
  value: boolean | string | number;
  /** Human-readable explanation of why this score was given. */
  reason: string;
  /** Optional trace citations supporting this score. */
  citations?: Citation[] | null;
}

/**
 * Pass/fail response for binary scorers.
 *
 * @example
 * ```typescript
 * return { value: true, reason: "Output contains expected answer" };
 * ```
 */
export interface BinaryResponse extends BaseResponse {
  value: boolean;
}

/**
 * Numeric score response (e.g. 0.0 to 1.0).
 *
 * @example
 * ```typescript
 * return { value: 0.85, reason: "Output is mostly relevant" };
 * ```
 */
export interface NumericResponse extends BaseResponse {
  value: number;
}

/**
 * Classification-style response for categorical scorers.
 *
 * @example
 * ```typescript
 * return { value: "positive", reason: "Sentiment is clearly positive" };
 * ```
 */
export interface CategoricalResponse extends BaseResponse {
  value: string;
}

/** Union of all concrete scorer response types. */
export type ScorerResponse =
  | BinaryResponse
  | NumericResponse
  | CategoricalResponse;
