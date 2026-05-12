import pc from "picocolors";
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
      const completed = resultsData.length;

      if (completed >= expectedCount) {
        const url = response.ui_results_url ?? "Failed to get UI results URL";
        console.log(
          `${pc.green("\u2713")} Evals completed and saved in ${pc.bold(`${elapsed.toFixed(1)}s`)}`,
        );
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

    console.log();

    for (let i = 0; i < resultsData.length; i++) {
      const res = resultsData[i];
      const success = res.scorers.every((s) => Boolean(s.success));

      if (success) {
        passed++;
        console.log(
          `${pc.green("\u2713")} Example ${i + 1}: ${pc.green("PASSED")}`,
        );
      } else {
        failed++;
        console.log(
          `${pc.red("\u2717")} Example ${i + 1}: ${pc.red("FAILED")}`,
        );
      }

      for (const s of res.scorers) {
        const scoreStr = s.score !== null ? s.score.toFixed(3) : "N/A";
        const colored = s.success ? pc.green(scoreStr) : pc.red(scoreStr);
        console.log(
          `  ${pc.dim(`${s.name}:`)} ${colored} ${pc.dim(`(threshold: ${s.threshold})`)}`,
        );
      }

      results.push({ success, scorers: res.scorers, example: examples[i] });
    }

    console.log();
    if (passed === results.length) {
      console.log(
        `${pc.bold(pc.green("\u2713 All tests passed!"))} (${passed}/${results.length})`,
      );
    } else {
      console.log(
        `${pc.bold(pc.yellow("\u26A0 Results:"))} ${pc.green(`${passed} passed`)} | ${pc.red(`${failed} failed`)}`,
      );
    }
    console.log(`${pc.dim("View full details:")} ${pc.underline(url)}`);
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
                `    ${s.name}: ${s.score !== null ? s.score.toFixed(3) : "N/A"} (threshold: ${s.threshold})`,
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
    console.log(pc.bold(pc.cyan("Starting Evaluation")));
    console.log(`${pc.dim("Run:")} ${evalRunName}`);
    console.log(`${pc.dim("Project:")} ${this._projectName}`);
    console.log(
      `${pc.dim("Examples:")} ${examples.length} | ${pc.dim("Scorers:")} ${scorers.length}`,
    );
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
