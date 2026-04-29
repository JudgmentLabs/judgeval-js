import type { Example } from "../data/Example";
import type { BaseResponse } from "./responses";

/**
 * Base class for building custom evaluation scorers.
 *
 * Subclass `Judge` and implement the `score` method to create your own
 * evaluation logic.
 *
 * @example
 * ```typescript
 * class ContainsAnswer extends Judge<BinaryResponse> {
 *   async score(data: Example): Promise<BinaryResponse> {
 *     const expected = (data.get("expected_output") as string).toLowerCase();
 *     const actual = (data.get("actual_output") as string).toLowerCase();
 *     return {
 *       value: actual.includes(expected),
 *       reason: expected ? "Found" : "Not found",
 *     };
 *   }
 * }
 * ```
 */
export abstract class Judge<R extends BaseResponse = BaseResponse> {
  /** Evaluate a single example and return a score. */
  abstract score(data: Example): Promise<R>;
}
