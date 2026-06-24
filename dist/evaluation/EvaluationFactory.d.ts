import type { JudgmentApiClient } from "../internal/api/client";
import { Evaluation } from "./Evaluation";
/**
 * Creates {@link Evaluation} instances for running batch scoring.
 *
 * Access via `client.evaluation`.
 *
 * @example
 * ```typescript
 * const evaluation = client.evaluation.create();
 * const results = await evaluation.run({ examples, scorers, evalRunName: "my-eval" });
 * ```
 */
export declare class EvaluationFactory {
    private readonly _client;
    private readonly _projectId;
    private readonly _projectName;
    constructor(client: JudgmentApiClient, projectId: string | null, projectName: string);
    /** Create a new `Evaluation` bound to the current project. */
    create(): Evaluation;
}
//# sourceMappingURL=EvaluationFactory.d.ts.map