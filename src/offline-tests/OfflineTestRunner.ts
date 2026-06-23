import type { JudgmentApiClient } from "../internal/api/client";
import type {
  ApplyTestRunSuccessRequest,
  CreateTestRunRequest,
  PreparedTestRunResponse,
} from "../internal/api/models";
import { Logger } from "../utils/logger";
import { Example } from "../data/Example";
import { Tracer } from "../trace/Tracer";
import { OfflineTracer } from "../trace/OfflineTracer";
import { JudgmentTracerProvider } from "../trace/JudgmentTracerProvider";
import {
  type AgentFunction,
  type JudgeVersionPin,
  type OfflineExampleResult,
  type OfflineScorerData,
  type OfflineTestResult,
  type PassConditionFn,
  type TestConfig,
  computePassed,
} from "./types";

const TERMINAL_STATUSES = new Set(["completed", "error", "cancelled"]);
const EXAMPLES_PAGE_SIZE = 100;
const ITEMS_PAGE_SIZE = 200;
const POLL_INTERVAL_MS = 2000;
const MAX_PAGES = 10_000;

interface ExampleRow {
  exampleId: string;
  data: Record<string, unknown>;
  offlineTraceId: string | null;
  createdAt: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function binaryLabel(value: boolean): string {
  return value ? "Yes" : "No";
}

/** Port of the Python `_scorer_value` helper. */
function scorerValue(scorer: Record<string, unknown>): string | number | null {
  const scoreType = scorer.score_type;
  const bool = scorer.bool_value;
  const str = scorer.str_value;
  const num = scorer.num_value;
  if (scoreType === "binary") {
    return typeof bool === "boolean" ? binaryLabel(bool) : null;
  }
  if (scoreType === "categorical") {
    return typeof str === "string" ? str : null;
  }
  if (scoreType === "numeric") {
    return typeof num === "number" ? num : null;
  }
  if (typeof bool === "boolean") return binaryLabel(bool);
  if (typeof str === "string") return str;
  if (typeof num === "number") return num;
  return null;
}

function reasonText(raw: unknown): string | null {
  if (typeof raw === "object" && raw !== null) {
    const text = (raw as Record<string, unknown>).text;
    return typeof text === "string" && text ? text : null;
  }
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        const text = (parsed as Record<string, unknown>).text;
        if (typeof text === "string") return text || null;
      }
    } catch {
      // not JSON; fall through to the raw string
    }
    return raw || null;
  }
  return null;
}

/** Validate `judgeVersions` and normalize each pin to the server's snake_case shape. */
function normalizeJudgeVersions(
  pins?: JudgeVersionPin[],
): Record<string, unknown>[] | undefined {
  if (!pins || pins.length === 0) return undefined;
  const out: Record<string, unknown>[] = [];
  for (const pin of pins) {
    if (!pin.name && !pin.judgeId) {
      throw new Error(
        "judgeVersions entries require a 'name' (or 'judgeId') key",
      );
    }
    const entry: Record<string, unknown> = {};
    if (pin.judgeId !== undefined) entry.judge_id = pin.judgeId;
    if (pin.name !== undefined) entry.name = pin.name;
    if (pin.tag !== undefined) entry.tag = pin.tag;
    if (pin.version !== undefined) entry.version = pin.version;
    if (pin.majorVersion !== undefined) entry.major_version = pin.majorVersion;
    if (pin.minorVersion !== undefined) entry.minor_version = pin.minorVersion;
    out.push(entry);
  }
  return out;
}

/** Options accepted by {@link OfflineTestRunner.run}. */
export interface OfflineRunOptions {
  agentFunction?: AgentFunction;
  judgeVersions?: JudgeVersionPin[];
  datasetVersion?: number | string;
  passConditionFn?: PassConditionFn;
  assertTest?: boolean;
  timeoutSeconds?: number;
  /** Optional display name for the run; server auto-names it when omitted. */
  runName?: string;
}

/**
 * Executes the offline-test lifecycle for a test config (the TypeScript port of
 * the Python `OfflineTestRunner`): resolve the dataset version, optionally run
 * the agent to produce offline traces, create the test run, wait for terminal
 * status, fetch results, evaluate the pass condition, and report successes.
 */
export class OfflineTestRunner {
  private readonly _client: JudgmentApiClient;
  private readonly _projectId: string;
  private readonly _projectName: string;

  constructor(
    client: JudgmentApiClient,
    projectId: string,
    projectName: string,
  ) {
    this._client = client;
    this._projectId = projectId;
    this._projectName = projectName;
  }

  async resolveDatasetVersion(
    testConfig: TestConfig,
    datasetVersion?: number | string,
  ): Promise<Record<string, unknown>> {
    const response =
      await this._client.getV1projectsDatasetsByDatasetIdentifierVersions(
        this._projectId,
        testConfig.datasetId,
      );
    const versions = asArray(response.versions)
      .filter((v) => typeof v === "object" && v !== null)
      .map((v) => v as Record<string, unknown>);

    if (datasetVersion === undefined) {
      if (versions.length === 0) {
        throw new Error(
          `Dataset of test config '${testConfig.name}' has no versions`,
        );
      }
      return versions.reduce((best, v) =>
        Number(v.version_number ?? 0) > Number(best.version_number ?? 0)
          ? v
          : best,
      );
    }

    if (typeof datasetVersion === "number") {
      const match = versions.find(
        (v) => Number(v.version_number ?? 0) === datasetVersion,
      );
      if (match) return match;
    } else {
      const match = versions.find((v) => v.version_id === datasetVersion);
      if (match) return match;
    }
    throw new Error(
      `Dataset version ${JSON.stringify(datasetVersion)} does not exist for the dataset of test config '${testConfig.name}'`,
    );
  }

  async fetchExamples(
    testConfig: TestConfig,
    versionNumber: number,
  ): Promise<ExampleRow[]> {
    const examples: ExampleRow[] = [];
    let cursorCreatedAt: string | undefined;
    let cursorExampleId: string | undefined;
    let pageCount = 0;

    for (;;) {
      if (pageCount >= MAX_PAGES) {
        throw new Error(
          `fetchExamples exceeded ${MAX_PAGES} pages for dataset of test config '${testConfig.name}'`,
        );
      }
      const page =
        await this._client.getV1projectsDatasetsByDatasetIdentifierPage(
          this._projectId,
          testConfig.datasetId,
          String(versionNumber),
          String(EXAMPLES_PAGE_SIZE),
          cursorCreatedAt,
          cursorExampleId,
        );
      pageCount += 1;

      for (const entry of asArray(page.entries)) {
        const example = asRecord(asRecord(entry).example);
        let data = example.data;
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch {
            data = {};
          }
        }
        examples.push({
          exampleId: asString(example.example_id),
          data: asRecord(data),
          offlineTraceId:
            typeof example.offline_trace_id === "string"
              ? example.offline_trace_id
              : null,
          createdAt:
            typeof example.created_at === "string" ? example.created_at : null,
        });
      }

      const metadata = asRecord(page.metadata);
      const nextCursor = asRecord(metadata.nextCursor);
      if (!metadata.hasMore || Object.keys(nextCursor).length === 0) break;
      cursorCreatedAt = asString(nextCursor.created_at);
      cursorExampleId = asString(nextCursor.example_id);
    }

    return examples;
  }

  createTestRun(
    testConfig: TestConfig,
    options: {
      datasetVersion?: number | string;
      judgeVersions?: JudgeVersionPin[];
      agentTraces?: Record<string, string>;
      source?: string;
      name?: string;
    } = {},
  ): Promise<PreparedTestRunResponse> {
    const payload: CreateTestRunRequest = {
      test_config_id: testConfig.id,
      source: options.source ?? "sdk",
    };
    if (options.name) {
      payload.name = options.name;
    }
    if (typeof options.datasetVersion === "number") {
      payload.dataset_version_number = options.datasetVersion;
    } else if (typeof options.datasetVersion === "string") {
      payload.dataset_version_id = options.datasetVersion;
    }
    const normalized = normalizeJudgeVersions(options.judgeVersions);
    if (normalized) {
      payload.judge_versions =
        normalized as CreateTestRunRequest["judge_versions"];
    }

    const agentTraces = options.agentTraces ?? {};
    if (Object.keys(agentTraces).length > 0) {
      payload.agent_traces = Object.entries(agentTraces).map(
        ([exampleId, traceId]) => ({
          example_id: exampleId,
          agent_offline_trace_id: traceId,
        }),
      );
    }

    return this._client.postV1projectsTestRuns(this._projectId, payload);
  }

  /**
   * Run the agent once per dataset example, producing one offline trace each.
   *
   * NOTE: the offline-tracer lifecycle here (active-tracer swap, async
   * `observe`, per-example trace attribution) still needs validation against a
   * live run.
   */
  async runAgent(
    agentFunction: AgentFunction,
    examples: ExampleRow[],
  ): Promise<Record<string, string>> {
    const captured: Example[] = [];
    // Restore whatever tracer was active before we swap in the offline tracer,
    // so an agent run doesn't leave the offline tracer globally active.
    const previousTracer =
      JudgmentTracerProvider.getInstance().getActiveTracer();
    await OfflineTracer.create({
      projectName: this._projectName,
      apiKey: this._client.getApiKey(),
      organizationId: this._client.getOrganizationId(),
      apiUrl: this._client.getBaseUrl(),
      dataset: captured,
      setActive: true,
    });

    const agentTraces: Record<string, string> = {};
    try {
      const wrapped = Tracer.observe(agentFunction, { spanType: "agent" });
      for (const example of examples) {
        const before = captured.length;
        try {
          await wrapped(example.data);
        } catch (error) {
          Logger.error(
            `Agent entrypoint raised for example ${example.exampleId}: ${String(error)}`,
          );
        }
        for (const produced of captured.slice(before)) {
          const traceId = produced.get("offline_trace_id");
          if (example.exampleId && typeof traceId === "string") {
            agentTraces[example.exampleId] = traceId;
            break;
          }
        }
      }
    } finally {
      await Tracer.forceFlush();
      if (previousTracer) previousTracer.setActive();
    }

    return agentTraces;
  }

  async waitForCompletion(
    testRunId: string,
    timeoutSeconds: number,
  ): Promise<string> {
    const start = Date.now();
    for (;;) {
      if ((Date.now() - start) / 1000 > timeoutSeconds) {
        throw new Error(
          `Test run ${testRunId} did not complete within ${timeoutSeconds}s`,
        );
      }
      const response = await this._client.getV1projectsTestRunsByTestRunId(
        this._projectId,
        testRunId,
      );
      const status = asString(asRecord(response.test_run).status);
      if (TERMINAL_STATUSES.has(status)) return status;
      await sleep(POLL_INTERVAL_MS);
    }
  }

  async fetchItems(
    testRunId: string,
  ): Promise<{ items: Record<string, unknown>[]; uiResultsUrl: string }> {
    const items: Record<string, unknown>[] = [];
    let uiResultsUrl = "";
    let cursor: string | undefined;
    let pageCount = 0;

    for (;;) {
      if (pageCount >= MAX_PAGES) {
        throw new Error(
          `fetchItems exceeded ${MAX_PAGES} pages for test run ${testRunId}`,
        );
      }
      const response = await this._client.getV1projectsTestRunsByTestRunIdItems(
        this._projectId,
        testRunId,
        String(ITEMS_PAGE_SIZE),
        cursor,
      );
      pageCount += 1;

      for (const item of asArray(response.results)) {
        items.push(asRecord(item));
      }
      if (!uiResultsUrl) uiResultsUrl = asString(response.ui_results_url);

      const nextCursor = response.next_cursor;
      if (!response.has_more || typeof nextCursor !== "string" || !nextCursor) {
        break;
      }
      cursor = nextCursor;
    }

    return { items, uiResultsUrl };
  }

  buildResults(
    items: Record<string, unknown>[],
    agentTraces: Record<string, string>,
    passConditionFn?: PassConditionFn,
  ): OfflineExampleResult[] {
    const results: OfflineExampleResult[] = [];
    for (const item of items) {
      const exampleId = asString(item.example_id);
      const data = asRecord(item.data);

      const scorers: OfflineScorerData[] = [];
      for (const raw of asArray(item.scorers)) {
        const scorer = asRecord(raw);
        const metadata: Record<string, unknown> = {
          judge_id: scorer.judge_id,
          judge_major_version: scorer.judge_major_version,
          judge_minor_version: scorer.judge_minor_version,
        };
        const reason = reasonText(scorer.reason);
        if (reason) metadata.reason = reason;
        scorers.push({
          name: asString(scorer.judge_name),
          value: scorerValue(scorer),
          scoreType:
            typeof scorer.score_type === "string" ? scorer.score_type : null,
          error: typeof scorer.error === "string" ? scorer.error : null,
          success: typeof scorer.success === "boolean" ? scorer.success : null,
          metadata,
        });
      }

      if (passConditionFn) {
        const passed = Boolean(passConditionFn({ ...data }, scorers));
        for (const scorer of scorers) scorer.success = passed;
      }

      results.push({
        exampleId,
        data,
        scorers,
        agentOfflineTraceId: agentTraces[exampleId],
      });
    }
    return results;
  }

  async reportSuccess(
    testRunId: string,
    prepared: PreparedTestRunResponse,
    items: Record<string, unknown>[],
    results: OfflineExampleResult[],
  ): Promise<void> {
    const refsByVersion = new Map<string, string>();
    const refsByName = new Map<string, string>();
    const versionKey = (
      exampleId: string,
      judgeId: string,
      major: number,
      minor: number,
    ): string => `${exampleId} ${judgeId} ${major} ${minor}`;
    const nameKey = (exampleId: string, judgeName: string): string =>
      `${exampleId} ${judgeName}`;

    for (const rawRef of asArray(prepared.evaluation_runs)) {
      const ref = asRecord(rawRef);
      const runId = ref.run_id;
      if (typeof runId !== "string" || !runId) continue;
      refsByVersion.set(
        versionKey(
          asString(ref.example_id),
          asString(ref.judge_id),
          Number(ref.judge_major_version ?? 0),
          Number(ref.judge_minor_version ?? 0),
        ),
        runId,
      );
      refsByName.set(
        nameKey(asString(ref.example_id), asString(ref.judge_name)),
        runId,
      );
    }

    const resultsByExample = new Map<string, OfflineExampleResult>();
    for (const result of results)
      resultsByExample.set(result.exampleId, result);

    const successes: ApplyTestRunSuccessRequest["successes"] = [];
    for (const item of items) {
      const exampleId = asString(item.example_id);
      const result = resultsByExample.get(exampleId);
      const successByIndex = result
        ? result.scorers.map((s) => s.success ?? null)
        : [];

      const scorerRows = asArray(item.scorers);
      for (let index = 0; index < scorerRows.length; index += 1) {
        const scorer = asRecord(scorerRows[index]);
        const evaluationRunId =
          refsByVersion.get(
            versionKey(
              exampleId,
              asString(scorer.judge_id),
              Number(scorer.judge_major_version ?? 0),
              Number(scorer.judge_minor_version ?? 0),
            ),
          ) ?? refsByName.get(nameKey(exampleId, asString(scorer.judge_name)));
        if (!evaluationRunId) {
          Logger.warning(
            `No evaluation run ref for scorer ${asString(scorer.judge_name)} of example ${exampleId}; skipping its success update`,
          );
          continue;
        }
        successes.push({
          evaluation_run_id: evaluationRunId,
          success: index < successByIndex.length ? successByIndex[index] : null,
        });
      }
    }

    if (successes.length === 0) return;
    await this._client.patchV1projectsTestRunsByTestRunIdSuccess(
      this._projectId,
      testRunId,
      { successes },
    );
  }

  async run(
    testConfig: TestConfig,
    options: OfflineRunOptions = {},
  ): Promise<OfflineTestResult> {
    const {
      agentFunction,
      judgeVersions,
      datasetVersion,
      passConditionFn,
      assertTest = false,
      timeoutSeconds = 600,
      runName,
    } = options;

    if (assertTest && !passConditionFn) {
      throw new Error(
        "assertTest=true requires a passConditionFn to decide whether each row passes.",
      );
    }

    Logger.info(
      `Starting offline test for config '${testConfig.name}' (project ${this._projectName})`,
    );

    const version = await this.resolveDatasetVersion(
      testConfig,
      datasetVersion,
    );
    const versionNumber = Number(version.version_number ?? 0);
    const examples = await this.fetchExamples(testConfig, versionNumber);
    Logger.info(
      `Dataset version ${versionNumber}: ${examples.length} example(s)`,
    );

    // Pin the run to the exact version the examples were fetched from.
    const pinnedVersion =
      typeof datasetVersion === "string" ? datasetVersion : versionNumber;

    let agentTraces: Record<string, string> = {};
    if (agentFunction && examples.length > 0) {
      agentTraces = await this.runAgent(agentFunction, examples);
    }

    const prepared = await this.createTestRun(testConfig, {
      datasetVersion: pinnedVersion,
      judgeVersions,
      agentTraces,
      name: runName,
    });
    const testRun = asRecord(prepared.test_run);
    const testRunId = asString(testRun.id);
    let uiResultsUrl = asString(prepared.ui_results_url);
    Logger.info(
      `Created test run ${testRunId} over ${examples.length} examples`,
    );

    const status = await this.waitForCompletion(testRunId, timeoutSeconds);

    const { items, uiResultsUrl: itemsUrl } = await this.fetchItems(testRunId);
    if (itemsUrl) uiResultsUrl = itemsUrl;

    const results = this.buildResults(items, agentTraces, passConditionFn);
    if (passConditionFn) {
      await this.reportSuccess(testRunId, prepared, items, results);
    }

    const outcome: OfflineTestResult = {
      testRunId,
      status,
      uiResultsUrl: uiResultsUrl || undefined,
      results,
      agentOfflineTraceIds: agentTraces,
      passed: computePassed(results),
    };

    if (assertTest) this._assertAllPassed(outcome);
    return outcome;
  }

  private _assertAllPassed(outcome: OfflineTestResult): void {
    if (outcome.status !== "completed") {
      throw new Error(
        `Test run ${outcome.testRunId} finished with status '${outcome.status}'`,
      );
    }
    const failed = outcome.results
      .filter((result) =>
        result.scorers.some((scorer) => scorer.success === false),
      )
      .map((result) => result.exampleId);
    if (failed.length > 0 || outcome.passed !== true) {
      throw new Error(
        `Test run ${outcome.testRunId} failed its pass condition for ${failed.length} example(s): ${JSON.stringify(failed)}`,
      );
    }
  }
}
