import pc from "picocolors";
import type { ExampleEvaluationRun } from "../internal/api/models/ExampleEvaluationRun";
import type { LocalScorerResult } from "../internal/api/models/LocalScorerResult";
import type { Example } from "../data/Example";
import type { Judge } from "../judges/Judge";
import type { BaseResponse } from "../judges/responses";
import { EvaluatorRunner } from "./EvaluatorRunner";

interface ScorerJobResult {
  exampleIdx: number;
  scorer: Judge;
  result: BaseResponse | null;
  error: string | null;
}

/**
 * Evaluation runner for custom (in-process) scorers.
 *
 * Runs all {@link Judge} instances locally against the provided examples,
 * posts results to the Judgment platform, then polls for finalized scores.
 * Used internally by {@link Evaluation}.
 */
export class LocalEvaluatorRunner extends EvaluatorRunner<Judge> {
  protected _buildPayload(
    evalId: string,
    projectId: string,
    evalRunName: string,
    createdAt: string,
    examples: Example[],
    _scorers: Judge[],
  ): ExampleEvaluationRun {
    return {
      id: evalId,
      project_id: projectId,
      eval_name: evalRunName,
      created_at: createdAt,
      examples: examples.map((e) => e.toJSON()),
      judgment_scorers: [],
      custom_scorers: [],
    };
  }

  protected async _submit(
    projectId: string,
    _evalId: string,
    examples: Example[],
    scorers: Judge[],
    payload: ExampleEvaluationRun,
  ): Promise<number> {
    const startTime = Date.now();

    const jobs: Promise<ScorerJobResult>[] = examples.flatMap(
      (example, exampleIdx) =>
        scorers.map((scorer) =>
          scorer
            .score(example)
            .then(
              (result): ScorerJobResult => ({
                exampleIdx,
                scorer,
                result,
                error: null,
              }),
            )
            .catch(
              (err: unknown): ScorerJobResult => ({
                exampleIdx,
                scorer,
                result: null,
                error: String(err),
              }),
            ),
        ),
    );

    const jobResults = await Promise.all(jobs);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `${pc.green("\u2713")} Scoring completed in ${pc.bold(`${elapsed}s`)}`,
    );

    // Group by example index
    const byExample = new Map<number, ScorerJobResult[]>();
    for (const jr of jobResults) {
      let list = byExample.get(jr.exampleIdx);
      if (!list) {
        list = [];
        byExample.set(jr.exampleIdx, list);
      }
      list.push(jr);
    }

    const apiResults: LocalScorerResult[] = examples.map((example, i) => {
      const entries = byExample.get(i) ?? [];
      return {
        scorers_data: entries.map((jr) => {
          if (jr.error !== null) {
            return {
              scorer_name: jr.scorer.constructor.name,
              value: 0,
              reason: "",
              error: jr.error,
            };
          }
          const r = jr.result!;
          return {
            scorer_name: jr.scorer.constructor.name,
            value: r.value,
            reason: r.reason,
            ...(r.citations && {
              citations: r.citations.map((c) => ({
                span_id: c.spanId,
                span_attribute: c.spanAttribute,
              })),
            }),
          };
        }),
        data_object: example.toJSON(),
      };
    });

    await this._client.postV1projectsEvalResultsExamples(projectId, {
      results: apiResults,
      run: payload,
    });

    return examples.length;
  }
}
