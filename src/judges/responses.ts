/** Links a score back to a specific span in a trace. */
export interface Citation {
  spanId: string;
  spanAttribute: string;
}

/** Base fields shared by all scorer response types. */
export interface BaseResponse {
  value: boolean | string | number;
  reason: string;
  citations?: Citation[] | null;
}

/** Pass/fail response for binary scorers. */
export interface BinaryResponse extends BaseResponse {
  value: boolean;
}

/** Numeric score response (e.g. 0.0 to 1.0). */
export interface NumericResponse extends BaseResponse {
  value: number;
}

/** Classification-style response. Subclass must provide valid categories. */
export interface CategoricalResponse extends BaseResponse {
  value: string;
}

export type ScorerResponse =
  | BinaryResponse
  | NumericResponse
  | CategoricalResponse;
