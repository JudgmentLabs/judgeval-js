import type { ExampleEvaluationRun } from "../internal/api/models/ExampleEvaluationRun";
import type { LocalScorerResult } from "../internal/api/models/LocalScorerResult";
import type { Example } from "../data/Example";
import type { Judge } from "../judges/Judge";
import type { ScorerResponse } from "../judges/responses";
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
    type ScorerResult = {
      exampleIdx: number;
      scorerName: string;
      result: ScorerResponse | null;
      error: string | null;
    };

    const jobs: Promise<ScorerResult>[] = [];
    for (let i = 0; i < examples.length; i++) {
      for (const scorer of scorers) {
        const exampleIdx = i;
        const scorerName = scorer.constructor.name;
        jobs.push(
          scorer
            .score(examples[exampleIdx])
            .then((result) => ({
              exampleIdx,
              scorerName,
              result: result as ScorerResponse,
              error: null,
            }))
            .catch((err: unknown) => ({
              exampleIdx,
              scorerName,
              result: null,
              error: String(err),
            })),
        );
      }
    }

    const jobResults = await Promise.all(jobs);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  Scoring completed in ${elapsed}s`);

    // Group results by example index
    const resultsByExample = new Map<number, ScorerResult[]>();
    for (const jr of jobResults) {
      const list = resultsByExample.get(jr.exampleIdx) ?? [];
      list.push(jr);
      resultsByExample.set(jr.exampleIdx, list);
    }

    // Build API results
    const apiResults: LocalScorerResult[] = [];
    for (let i = 0; i < examples.length; i++) {
      const exampleResults = resultsByExample.get(i) ?? [];
      const scorerEntries = exampleResults.map((jr) => {
        if (jr.error !== null) {
          return {
            scorer_name: jr.scorerName,
            value: 0 as number | boolean | string,
            reason: "",
            error: jr.error,
          };
        }
        const entry: {
          scorer_name: string;
          value: boolean | number | string;
          reason: string;
          citations?: { span_id: string; span_attribute: string }[];
          error?: string | null;
        } = {
          scorer_name: jr.scorerName,
          value: jr.result!.value,
          reason: jr.result!.reason,
          error: null,
        };
        if (jr.result!.citations) {
          entry.citations = jr.result!.citations.map((c) => ({
            span_id: c.spanId,
            span_attribute: c.spanAttribute,
          }));
        }
        return entry;
      });

      apiResults.push({
        scorers_data: scorerEntries,
        data_object: examples[i].toDict(),
      });
    }

    // Post results to backend
    await this._client.postV1projectsEvalResultsExamples(projectId, {
      results: apiResults,
      run: payload,
    });
    console.log("  Local scorer results logged to backend");

    return examples.length;
  }
}
