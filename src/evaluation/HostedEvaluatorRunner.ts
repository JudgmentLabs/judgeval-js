import pc from "picocolors";
import type { ExampleEvaluationRun } from "../internal/api/models/ExampleEvaluationRun";
import type { Example } from "../data/Example";
import { EvaluatorRunner } from "./EvaluatorRunner";

/**
 * Evaluation runner for hosted (server-side) scorers.
 *
 * Submits scorer names to the Judgment platform's evaluation queue
 * and polls for results. Used internally by {@link Evaluation}.
 */
export class HostedEvaluatorRunner extends EvaluatorRunner<string> {
  protected _buildPayload(
    evalId: string,
    projectId: string,
    evalRunName: string,
    createdAt: string,
    examples: Example[],
    scorers: string[],
  ): ExampleEvaluationRun {
    return {
      id: evalId,
      project_id: projectId,
      eval_name: evalRunName,
      created_at: createdAt,
      examples: examples.map((e) => e.toJSON()),
      judgment_scorers: scorers.map((name) => ({ name })),
      custom_scorers: [],
    };
  }

  protected async _submit(
    projectId: string,
    _evalId: string,
    examples: Example[],
    _scorers: string[],
    payload: ExampleEvaluationRun,
  ): Promise<number> {
    await this._client.postV1projectsEvalQueueExamples(projectId, payload);
    console.log(`${pc.green("\u2713")} Evaluation submitted`);
    return examples.length;
  }
}
