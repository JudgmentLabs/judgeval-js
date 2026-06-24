import type { ExampleEvaluationRun } from "../internal/api/models/ExampleEvaluationRun";
import type { Example } from "../data/Example";
import { EvaluatorRunner } from "./EvaluatorRunner";
/**
 * Evaluation runner for hosted (server-side) scorers.
 *
 * Submits scorer names to the Judgment platform's evaluation queue
 * and polls for results. Used internally by {@link Evaluation}.
 */
export declare class HostedEvaluatorRunner extends EvaluatorRunner<string> {
    protected _buildPayload(evalId: string, projectId: string, evalRunName: string, createdAt: string, examples: Example[], scorers: string[]): ExampleEvaluationRun;
    protected _submit(projectId: string, _evalId: string, examples: Example[], _scorers: string[], payload: ExampleEvaluationRun): Promise<number>;
}
//# sourceMappingURL=HostedEvaluatorRunner.d.ts.map