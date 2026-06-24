import type { Example } from "./Example";
import type { ExperimentScorer } from "../internal/api/models/ExperimentScorer";
/** The combined result of running scorers against a single example. */
export interface ScoringResult {
    /** True only if every scorer passed its threshold. */
    success: boolean;
    /** Per-scorer results, directly from the API. */
    scorers: ExperimentScorer[];
    /** The original example that was evaluated. */
    example: Example;
}
//# sourceMappingURL=ScoringResult.d.ts.map