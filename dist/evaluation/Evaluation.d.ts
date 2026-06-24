import type { JudgmentApiClient } from "../internal/api/client";
import type { Example } from "../data/Example";
import type { ScoringResult } from "../data/ScoringResult";
import { Judge } from "../judges/Judge";
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
export declare class Evaluation {
    private readonly _local;
    private readonly _hosted;
    constructor(client: JudgmentApiClient, projectId: string | null, projectName: string);
    /**
     * Run scorers against your examples and return results.
     *
     * Pass **either** hosted scorer names (strings) **or** custom {@link Judge}
     * instances. Mixing both in one call is not supported.
     *
     * @param options - Evaluation configuration including examples, scorers, and run name.
     * @returns A list of {@link ScoringResult} objects, one per example.
     */
    run(options: EvaluationRunOptions): Promise<ScoringResult[]>;
}
//# sourceMappingURL=Evaluation.d.ts.map