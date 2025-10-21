import type { Example } from "./data";
import { ExampleEvaluationRun } from "./data";
import { JUDGMENT_API_KEY, JUDGMENT_API_URL, JUDGMENT_ORG_ID } from "./env";
import { JudgmentApiClient } from "./internal/api";
import { ScorerData, ScoringResult } from "./internal/api/models";
import { BaseScorer } from "./scorers";
import { ExampleScorer } from "./scorers/example-scorer";

export class JudgmentClient {
  private readonly apiClient: JudgmentApiClient;

  constructor(
    apiKey: string | null = JUDGMENT_API_KEY,
    organizationId: string | null = JUDGMENT_ORG_ID,
  ) {
    if (apiKey === null || organizationId === null) {
      throw new Error("API key and organization ID are required");
    }

    this.apiClient = new JudgmentApiClient(
      JUDGMENT_API_URL,
      apiKey,
      organizationId,
    );
  }

  async runEvaluation(
    examples: Example[],
    scorers: BaseScorer[],
    projectName: string,
    evalRunName: string,
    model?: string,
  ): Promise<ScoringResult[]> {
    const evalRun = new ExampleEvaluationRun({
      project_name: projectName,
      eval_name: evalRunName,
      examples,
      scorers,
      model,
    });

    return this.runEval(evalRun);
  }

  private async runEval(
    evaluationRun: ExampleEvaluationRun,
  ): Promise<ScoringResult[]> {
    if (evaluationRun.examples.length === 0) {
      throw new Error("No examples provided");
    }

    const hasCustomScorers = Boolean(evaluationRun.custom_scorers.length);
    const hasJudgmentScorers = Boolean(evaluationRun.judgment_scorers.length);

    if (hasCustomScorers && hasJudgmentScorers) {
      throw new Error(
        "Cannot run both local and Judgment API scorers at the same time",
      );
    }

    if (hasJudgmentScorers) {
      return this.runJudgmentScorers(evaluationRun);
    }

    return this.runCustomScorers(evaluationRun);
  }

  private async runJudgmentScorers(
    evaluationRun: ExampleEvaluationRun,
  ): Promise<ScoringResult[]> {
    console.log("Running evaluation...");

    await this.apiClient.addToRunEvalQueueExamples(evaluationRun);

    const results = await this.pollForResults(
      evaluationRun.project_name,
      evaluationRun.id,
      evaluationRun.examples.length,
    );

    console.log(
      `View results at: ${JUDGMENT_API_URL}/projects/${evaluationRun.project_name}/evals/${evaluationRun.eval_name}/example`,
    );

    return results;
  }

  private async runCustomScorers(
    evaluationRun: ExampleEvaluationRun,
  ): Promise<ScoringResult[]> {
    console.log("Running local evaluation...");

    const results: ScoringResult[] = [];

    for (const example of evaluationRun.examples) {
      const scorersData: ScorerData[] = [];

      for (const scorer of evaluationRun.custom_scorers) {
        if (!(scorer instanceof ExampleScorer)) {
          continue;
        }

        try {
          const score = await scorer.scoreExample(example);
          scorer.score = score;
          scorer.success = scorer.successCheck();
        } catch (error) {
          scorer.error = error instanceof Error ? error.message : String(error);
          scorer.score = null;
          scorer.success = false;
        }

        const scorerData: ScorerData = {
          name: scorer.name ?? "Unknown",
          threshold: scorer.threshold ?? 0.5,
          success: scorer.success ?? false,
          score: scorer.score,
          reason: scorer.reason,
          strict_mode: scorer.strict_mode,
          evaluation_model: scorer.model,
          error: scorer.error,
          additional_metadata: scorer.additional_metadata,
        };

        scorersData.push(scorerData);
      }

      const result: ScoringResult = {
        success: scorersData.every((s) => s.success),
        scorers_data: scorersData,
        data_object: example,
      };

      results.push(result);
    }

    const response = await this.apiClient.logEvalResults({
      results,
      run: evaluationRun,
    });

    console.log(`View results at: ${response.ui_results_url}/example`);

    return results;
  }

  private async pollForResults(
    projectName: string,
    experimentRunId: string,
    expectedCount: number,
  ): Promise<ScoringResult[]> {
    for (let i = 0; i < 60; i++) {
      const response = await this.apiClient.fetchExperimentRun({
        experiment_run_id: experimentRunId,
        project_name: projectName,
      });

      if (response.results.length === expectedCount) {
        return response.results;
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    throw new Error("Evaluation timed out");
  }
}
