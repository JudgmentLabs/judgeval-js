import type { ExampleEvaluationRun } from "../internal/api/models/ExampleEvaluationRun";
import type { Example } from "../data/Example";
import type { Judge } from "../judges/Judge";
import { EvaluatorRunner } from "./EvaluatorRunner";
/**
 * Evaluation runner for custom (in-process) scorers.
 *
 * Runs all {@link Judge} instances locally against the provided examples,
 * posts results to the Judgment platform, then polls for finalized scores.
 * Used internally by {@link Evaluation}.
 */
export declare class LocalEvaluatorRunner extends EvaluatorRunner<Judge> {
    protected _buildPayload(evalId: string, projectId: string, evalRunName: string, createdAt: string, examples: Example[], _scorers: Judge[]): ExampleEvaluationRun;
    protected _submit(projectId: string, _evalId: string, examples: Example[], scorers: Judge[], payload: ExampleEvaluationRun): Promise<number>;
}
//# sourceMappingURL=LocalEvaluatorRunner.d.ts.map