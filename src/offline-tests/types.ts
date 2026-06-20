/**
 * Types for the offline-tests SDK surface. Mirrors the Python
 * `judgeval.offline_tests` module (TestConfig, OfflineTestResult,
 * JudgeVersionPin, AgentFunction, PassConditionFn) in TypeScript idiom.
 */

/**
 * A reusable offline-test configuration (a dataset + a set of platform judges).
 * Created via `client.offlineTests.createConfig()`.
 */
export interface TestConfig {
  /** Unique test config id. */
  id: string;
  /** Config name. */
  name: string;
  /** The dataset evaluated by this config. */
  datasetId: string;
  /** Optional human-readable description. */
  description?: string | null;
  /** ISO-8601 creation timestamp. */
  createdAt?: string | null;
  /** The judge membership rows as returned by the server. */
  judges: Record<string, unknown>[];
}

/** Build a {@link TestConfig} from a raw server `test_config` object. */
export function testConfigFromDict(data: Record<string, unknown>): TestConfig {
  const judges = Array.isArray(data.judges)
    ? (data.judges.filter((j) => typeof j === "object" && j !== null) as Record<
        string,
        unknown
      >[])
    : [];
  return {
    id: typeof data.id === "string" ? data.id : "",
    name: typeof data.name === "string" ? data.name : "",
    datasetId: typeof data.dataset_id === "string" ? data.dataset_id : "",
    description: typeof data.description === "string" ? data.description : null,
    createdAt: typeof data.created_at === "string" ? data.created_at : null,
    judges,
  };
}

/**
 * A single `judgeVersions` entry. Identify the judge by `name` or `judgeId`;
 * optionally pin a `tag`, a `version` string, or a `majorVersion`/`minorVersion`
 * pair. Every entry must carry a `name` or `judgeId`.
 */
export interface JudgeVersionPin {
  name?: string;
  judgeId?: string;
  tag?: string;
  version?: string;
  majorVersion?: number;
  minorVersion?: number;
}

/** One judge's result for one example. */
export interface OfflineScorerData {
  /** Judge name. */
  name: string;
  /** The scorer result: `"Yes"`/`"No"` (binary), the category (categorical), or a number. */
  value: string | number | null;
  /** Result type returned by the scorer. */
  scoreType?: string | null;
  /** Error message, if the judge errored on this row. */
  error?: string | null;
  /** Pass-condition outcome for the row, when a `passConditionFn` was supplied. */
  success?: boolean | null;
  /** Extra metadata (judge id/version, reason). */
  metadata: Record<string, unknown>;
}

/** Per-example results for an offline test run. */
export interface OfflineExampleResult {
  exampleId: string;
  data: Record<string, unknown>;
  scorers: OfflineScorerData[];
  /** The offline trace produced by the agent entrypoint (agent testing only). */
  agentOfflineTraceId?: string;
}

/** The outcome of an offline test run, returned by `client.offlineTests.run()`. */
export interface OfflineTestResult {
  /** The test run id. */
  testRunId: string;
  /** Final run status. */
  status: string;
  /** Link to the results page in the dashboard. */
  uiResultsUrl?: string;
  /** One entry per dataset example, with per-judge scorer rows. */
  results: OfflineExampleResult[];
  /** Mapping of example id to the agent's offline trace (agent testing only). */
  agentOfflineTraceIds: Record<string, string>;
  /** Whether every row passed its pass condition; `null` when none was evaluated. */
  passed: boolean | null;
}

/**
 * An agent entrypoint. Called once per dataset example with the example's data
 * fields as a single object (the TypeScript analogue of the Python keyword
 * arguments). Each call is wrapped in an `OfflineTracer` and its offline trace
 * is attributed to the result row.
 */
export type AgentFunction = (
  fields: Record<string, unknown>,
) => unknown | Promise<unknown>;

/**
 * A pass-condition callback evaluated per example row; its boolean outcome is
 * stored as the row's `success`.
 */
export type PassConditionFn = (
  dataFields: Record<string, unknown>,
  scorers: OfflineScorerData[],
) => boolean;

/** Whether every evaluated pass-condition passed; `null` when none was evaluated. */
export function computePassed(results: OfflineExampleResult[]): boolean | null {
  const successes: boolean[] = [];
  for (const result of results) {
    for (const scorer of result.scorers) {
      if (scorer.success !== null && scorer.success !== undefined) {
        successes.push(scorer.success);
      }
    }
  }
  if (successes.length === 0) return null;
  return successes.every((s) => s);
}
