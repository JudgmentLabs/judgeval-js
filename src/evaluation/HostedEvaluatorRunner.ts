import pc from "picocolors";
import type { ExampleEvaluationRun } from "../internal/api/models/ExampleEvaluationRun";
import type { Example } from "../data/Example";
import { EvaluatorRunner } from "./EvaluatorRunner";

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
      examples: examples.map((e) => e.toDict()),
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
