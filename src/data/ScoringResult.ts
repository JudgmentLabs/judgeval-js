import type { Example } from "./Example";
import type { ScorerData } from "./ScorerData";

/** The combined result of running scorers against a single example. */
export interface ScoringResult {
  success: boolean;
  scorersData: ScorerData[];
  dataObject: Example;
  name?: string | null;
  traceId?: string | null;
  runDuration?: number | null;
  evaluationCost?: number | null;
}
