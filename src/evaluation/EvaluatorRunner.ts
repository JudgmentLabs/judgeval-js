import type { JudgmentApiClient } from "../internal/api/client";
import type { ExampleEvaluationRun } from "../internal/api/models/ExampleEvaluationRun";
import type { ExperimentRunItem } from "../internal/api/models/ExperimentRunItem";
import type { Example } from "../data/Example";
import type { ScoringResult } from "../data/ScoringResult";
import type { Judge } from "../judges/Judge";

const POLL_INTERVAL_MS = 2000;

/**
 * Abstract base for evaluation runners.
 *
 * Provides the shared run -> poll -> display flow.
 * Subclasses implement `_buildPayload` and `_submit` for local vs hosted mode.
 */
export abstract class EvaluatorRunner<S extends string | Judge> {
  protected readonly _client: JudgmentApiClient;
  protected readonly _projectId: string | null;
  protected readonly _projectName: string;

  constructor(
    client: JudgmentApiClient,
    projectId: string | null,
    projectName: string,
  ) {
    this._client = client;
    this._projectId = projectId;
    this._projectName = projectName;
  }

  protected abstract _buildPayload(
    evalId: string,
    projectId: string,
    evalRunName: string,
    createdAt: string,
    examples: Example[],
    scorers: S[],
  ): ExampleEvaluationRun;

  protected abstract _submit(
    projectId: string,
    evalId: string,
    examples: Example[],
    scorers: S[],
    payload: ExampleEvaluationRun,
  ): Promise<number>;

  protected async _poll(
    projectId: string,
    evalId: string,
    expectedCount: number,
    timeoutSeconds: number,
  ): Promise<{ results: ExperimentRunItem[]; url: string }> {
    const startTime = Date.now();

    while (true) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > timeoutSeconds) {
        throw new Error(`Evaluation timed out after ${timeoutSeconds}s`);
      }

      const response = await this._client.getV1projectsExperimentsByRunId(
        projectId,
        evalId,
      );
      const resultsData = response.results ?? [];

      console.log(`  Evals completed: ${resultsData.length}/${expectedCount}`);

      if (resultsData.length === expectedCount) {
        const url = response.ui_results_url ?? "Failed to get UI results URL";
        console.log(`  Evals completed and saved in ${elapsed.toFixed(1)}s`);
        return { results: resultsData, url };
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  protected _displayResults(
    examples: Example[],
    resultsData: ExperimentRunItem[],
    url: string,
    assertTest: boolean,
  ): ScoringResult[] {
    const results: ScoringResult[] = [];
    let passed = 0;
    let failed = 0;

    for (let i = 0; i < resultsData.length; i++) {
      const res = resultsData[i];
      const success = res.scorers.every((s) => Boolean(s.success));

      if (success) {
        passed++;
        console.log(`  Example ${i + 1}: PASSED`);
      } else {
        failed++;
        console.log(`  Example ${i + 1}: FAILED`);
      }

      for (const s of res.scorers) {
        console.log(
          `    ${s.name}: ${s.score.toFixed(3)} (threshold: ${s.threshold})`,
        );
      }

      results.push({ success, scorers: res.scorers, example: examples[i] });
    }

    console.log();
    if (passed === results.length) {
      console.log(`  All tests passed! (${passed}/${results.length})`);
    } else {
      console.log(`  Results: ${passed} passed | ${failed} failed`);
    }
    console.log(`  View full details: ${url}`);
    console.log();

    if (assertTest && results.some((r) => !r.success)) {
      const lines = [
        `Evaluation failed: ${failed}/${results.length} examples failed`,
      ];
      for (let i = 0; i < results.length; i++) {
        if (!results[i].success) {
          lines.push(`  Example ${i + 1}:`);
          for (const s of results[i].scorers) {
            if (!s.success) {
              lines.push(
                `    ${s.name}: ${s.score.toFixed(3)} (threshold: ${s.threshold})`,
              );
              if (s.reason) lines.push(`      ${s.reason}`);
            }
          }
        }
      }
      throw new Error(lines.join("\n"));
    }

    return results;
  }

  async run(
    examples: Example[],
    scorers: S[],
    evalRunName: string,
    assertTest: boolean = false,
    timeoutSeconds: number = 300,
  ): Promise<ScoringResult[]> {
    if (!this._projectId) {
      console.error(
        "Project ID is not resolved. Evaluation requires a valid project.",
      );
      return [];
    }
    const projectId = this._projectId;
    const evalId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    console.log();
    console.log("Starting Evaluation");
    console.log(`  Run: ${evalRunName}`);
    console.log(`  Project: ${this._projectName}`);
    console.log(`  Examples: ${examples.length} | Scorers: ${scorers.length}`);
    console.log();

    const payload = this._buildPayload(
      evalId,
      projectId,
      evalRunName,
      createdAt,
      examples,
      scorers,
    );

    const expectedCount = await this._submit(
      projectId,
      evalId,
      examples,
      scorers,
      payload,
    );

    const { results: resultsData, url } = await this._poll(
      projectId,
      evalId,
      expectedCount,
      timeoutSeconds,
    );

    return this._displayResults(examples, resultsData, url, assertTest);
  }
}
