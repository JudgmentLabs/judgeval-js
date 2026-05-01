import type { JudgmentApiClient } from "../internal/api/client";
import type { Example } from "../data/Example";
import type { ScoringResult } from "../data/ScoringResult";
import { Judge } from "../judges/Judge";
import { LocalEvaluatorRunner } from "./LocalEvaluatorRunner";
import { HostedEvaluatorRunner } from "./HostedEvaluatorRunner";

export interface EvaluationRunOptions {
  /** The examples to evaluate. */
  examples: Example[];
  /**
   * Hosted scorer names (strings like `"faithfulness"`) **or**
   * custom `Judge` instances. Cannot mix both.
   */
  scorers: string[] | Judge[];
  /** A name for this run, visible in the dashboard. */
  evalRunName: string;
  /**
   * If true, throws an error when any scorer fails its threshold.
   * Useful in CI/CD pipelines.
   */
  assertTest?: boolean;
  /**
   * Maximum seconds to wait for hosted scorer results before timing out.
   * @default 300
   */
  timeoutSeconds?: number;
}

/**
 * Score a batch of examples using hosted scorers or custom judges.
 *
 * Two modes are supported:
 *
 * - **Hosted scorers** — pass scorer names as strings (e.g.
 *   `"faithfulness"`, `"answer_relevancy"`). Evaluation runs server-side
 *   on the Judgment platform.
 * - **Custom judges** — pass {@link Judge} subclass instances for
 *   in-process evaluation with your own scoring logic.
 *
 * Create an `Evaluation` via `client.evaluation.create()`, then call
 * `.run()` to execute scorers against your examples.
 *
 * @example
 * ```typescript
 * const evaluation = client.evaluation.create();
 * const results = await evaluation.run({
 *   examples,
 *   scorers: ["faithfulness", "answer_relevancy"],
 *   evalRunName: "nightly-eval",
 * });
 * ```
 */
export class Evaluation {
  private readonly _local: LocalEvaluatorRunner;
  private readonly _hosted: HostedEvaluatorRunner;

  constructor(
    client: JudgmentApiClient,
    projectId: string | null,
    projectName: string,
  ) {
    this._local = new LocalEvaluatorRunner(client, projectId, projectName);
    this._hosted = new HostedEvaluatorRunner(client, projectId, projectName);
  }

  /**
   * Run scorers against your examples and return results.
   *
   * Pass **either** hosted scorer names (strings) **or** custom {@link Judge}
   * instances. Mixing both in one call is not supported.
   *
   * @param options - Evaluation configuration including examples, scorers, and run name.
   * @returns A list of {@link ScoringResult} objects, one per example.
   */
  run(options: EvaluationRunOptions): Promise<ScoringResult[]> {
    const {
      examples,
      scorers,
      evalRunName,
      assertTest = false,
      timeoutSeconds = 300,
    } = options;

    const hostedScorers = scorers.filter(
      (s): s is string => typeof s === "string",
    );
    const localScorers = scorers.filter((s): s is Judge => s instanceof Judge);

    if (localScorers.length > 0 && hostedScorers.length > 0) {
      console.error(
        "Running both local and hosted scorers is not supported. " +
          "Please run your evaluation with either local or hosted scorers, but not both.",
      );
      return Promise.resolve([]);
    }
    if (localScorers.length === 0 && hostedScorers.length === 0) {
      console.error(
        "No valid local or hosted scorers provided. " +
          "Please provide at least one local or hosted scorer.",
      );
      return Promise.resolve([]);
    }

    if (localScorers.length > 0) {
      return this._local.run(
        examples,
        localScorers,
        evalRunName,
        assertTest,
        timeoutSeconds,
      );
    }

    return this._hosted.run(
      examples,
      hostedScorers,
      evalRunName,
      assertTest,
      timeoutSeconds,
    );
  }
}
