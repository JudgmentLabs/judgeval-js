import type { ExampleEvaluationRun } from "../internal/api/models/ExampleEvaluationRun";
import type { LocalScorerResult } from "../internal/api/models/LocalScorerResult";
import type { Example } from "../data/Example";
import type { Judge } from "../judges/Judge";
import type { BaseResponse } from "../judges/responses";
import { EvaluatorRunner } from "./EvaluatorRunner";

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
      examples: examples.map((e) => e.toDict()),
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
    const totalJobs = examples.length * scorers.length;
    console.log(`  Running ${totalJobs} local scorer jobs...`);
    const startTime = Date.now();

    // Run all (example, scorer) pairs concurrently
    const jobs = examples.flatMap((example, exampleIdx) =>
      scorers.map((scorer) =>
        scorer
          .score(example)
          .then((result) => ({ exampleIdx, scorer, result, error: null }))
          .catch((err: unknown) => ({
            exampleIdx,
            scorer,
            result: null as BaseResponse | null,
            error: String(err),
          })),
      ),
    );

    const jobResults = await Promise.all(jobs);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  Scoring completed in ${elapsed}s`);

    // Group by example index
    const byExample = new Map<number, (typeof jobResults)[number][]>();
    for (const jr of jobResults) {
      let list = byExample.get(jr.exampleIdx);
      if (!list) {
        list = [];
        byExample.set(jr.exampleIdx, list);
      }
      list.push(jr);
    }

    // Build API results using the LocalScorerResult shape directly
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
        data_object: example.toDict(),
      };
    });

    await this._client.postV1projectsEvalResultsExamples(projectId, {
      results: apiResults,
      run: payload,
    });
    console.log("  Local scorer results logged to backend");

    return examples.length;
  }
}
