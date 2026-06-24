import type { JudgmentApiClient } from "../internal/api/client";
import type { ExampleEvaluationRun } from "../internal/api/models/ExampleEvaluationRun";
import type { ExperimentRunItem } from "../internal/api/models/ExperimentRunItem";
import type { Example } from "../data/Example";
import type { ScoringResult } from "../data/ScoringResult";
import type { Judge } from "../judges/Judge";
/**
 * Abstract base for evaluation runners.
 *
 * Provides the shared run -> poll -> display flow.
 * Subclasses implement `_buildPayload` and `_submit` for local vs hosted mode.
 */
export declare abstract class EvaluatorRunner<S extends string | Judge> {
    protected readonly _client: JudgmentApiClient;
    protected readonly _projectId: string | null;
    protected readonly _projectName: string;
    constructor(client: JudgmentApiClient, projectId: string | null, projectName: string);
    protected abstract _buildPayload(evalId: string, projectId: string, evalRunName: string, createdAt: string, examples: Example[], scorers: S[]): ExampleEvaluationRun;
    protected abstract _submit(projectId: string, evalId: string, examples: Example[], scorers: S[], payload: ExampleEvaluationRun): Promise<number>;
    protected _poll(projectId: string, evalId: string, expectedCount: number, timeoutSeconds: number): Promise<{
        results: ExperimentRunItem[];
        url: string;
    }>;
    protected _displayResults(examples: Example[], resultsData: ExperimentRunItem[], url: string, assertTest: boolean): ScoringResult[];
    run(examples: Example[], scorers: S[], evalRunName: string, assertTest?: boolean, timeoutSeconds?: number): Promise<ScoringResult[]>;
}
//# sourceMappingURL=EvaluatorRunner.d.ts.map