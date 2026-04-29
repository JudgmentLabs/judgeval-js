import type { JudgmentApiClient } from "../internal/api/client";
import { Evaluation } from "./Evaluation";

/** Creates `Evaluation` instances for running batch scoring. */
export class EvaluationFactory {
  private readonly _client: JudgmentApiClient;
  private readonly _projectId: string | null;
  private readonly _projectName: string;

  constructor(
    client: JudgmentApiClient,
    projectId: string | null,
    projectName: string,
  ) {
    this._client = client;
    this._projectId = projectId;
    this._projectName = projectName;
  }

  /** Create a new `Evaluation` bound to the current project. */
  create(): Evaluation {
    return new Evaluation(this._client, this._projectId, this._projectName);
  }
}
