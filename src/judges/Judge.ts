import type { Example } from "../data/Example";
import type { BaseResponse } from "./responses";

/**
 * Base class for building Code judges.
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
 *       reason: actual.includes(expected) ? "Found" : "Not found",
 *     };
 *   }
 * }
 * ```
 */
export abstract class Judge<R extends BaseResponse = BaseResponse> {
  /** Numbers recorded with `metric`, by metric name. */
  readonly recordedMetrics: Record<string, number> = {};

  /**
   * Record a named number about the trace being scored.
   *
   * Call this from `score` to report measurements such as tool calls, cost or
   * latency, separately from the score you return. Recording the same name
   * again replaces its value.
   *
   * @param name - The metric's name, for example `"tool_calls"`.
   * @param value - A finite number.
   * @throws RangeError if `value` is not a finite number.
   *
   * @example
   * ```typescript
   * class ShortAnswer extends Judge<BinaryResponse> {
   *   async score(data: Example): Promise<BinaryResponse> {
   *     const length = (data.get("actual_output") as string).length;
   *     this.metric("output_chars", length);
   *     return { value: length <= 500, reason: `${length} characters` };
   *   }
   * }
   * ```
   */
  metric(name: string, value: number): void {
    if (!Number.isFinite(value)) {
      throw new RangeError(
        `Metric "${name}" must be a finite number, got ${value}`,
      );
    }
    this.recordedMetrics[name] = value;
  }

  /** Evaluate a single example and return a score. */
  abstract score(data: Example): Promise<R>;
}
