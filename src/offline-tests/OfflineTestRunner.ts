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
import { OFFLINE_EXAMPLE_ID_KEY } from "../trace/processors/OfflineJudgmentSpanProcessor";
import { sleep } from "../utils/sleep";
import { pLimit } from "../utils/p-limit";
import {
  type AgentFunction,
  type JudgeVersionPin,
  type OfflineExampleResult,
  type OfflineTestResult,
  type PassConditionFn,
  type TestConfig,
  computePassed,
} from "./types";
import {
  asArray,
  asRecord,
  asString,
  assertAllPassed,
  buildResults,
  displayResults,
  displayStart,
  normalizeJudgeVersions,
} from "./utils";

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
  /**
   * Maximum number of examples the agent runs over at a time. Defaults to 1
   * (sequential, in dataset order). Only affects the agent execution loop;
   * judge scoring happens server-side and is unaffected.
   */
  concurrency?: number;
}

/**
 * Executes the offline-test lifecycle for a test config: resolve the dataset
 * version, optionally run the agent to produce offline traces, create the test
 * run, wait for terminal status, fetch results, evaluate the pass condition,
 * and report successes.
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
   * Up to `concurrency` examples run at a time; the default of 1 runs them
   * sequentially in dataset order. Each example id rides on the OTel context,
   * so the offline span processor can pair it with the root span it starts
   * regardless of completion order.
   */
  async runAgent(
    agentFunction: AgentFunction,
    examples: ExampleRow[],
    concurrency = 1,
  ): Promise<Record<string, string>> {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new Error(
        `concurrency must be an integer >= 1, got ${concurrency}`,
      );
    }

    const provider = JudgmentTracerProvider.getInstance();
    // Restore whatever tracer was active before we swap in the offline tracer,
    // so an agent run doesn't leave the offline tracer globally active.
    const previousTracer = provider.getActiveTracer();
    const offlineTracer = await OfflineTracer.create({
      projectName: this._projectName,
      apiKey: this._client.getApiKey(),
      organizationId: this._client.getOrganizationId(),
      apiUrl: this._client.getBaseUrl(),
      dataset: [] as Example[],
      setActive: true,
    });
    const processor = offlineTracer.getSpanProcessor();

    try {
      if (provider.getActiveTracer() !== offlineTracer) {
        throw new Error(
          "Offline tracer could not be activated because another tracer has a recording root span; " +
            "agent traces cannot be attributed to this test run. " +
            "Run offline tests outside of any active observed span.",
        );
      }

      const wrapped = Tracer.observe(agentFunction, { spanType: "agent" });
      const limit = pLimit(concurrency);
      await Promise.all(
        examples.map((example) =>
          limit(async () => {
            // The processor pairs the root span it starts under this context
            // with the example id.
            const ctx = provider
              .getCurrentContext()
              .setValue(OFFLINE_EXAMPLE_ID_KEY, example.exampleId);
            try {
              await provider.withContext(ctx, () => wrapped(example.data));
            } catch (error) {
              Logger.error(
                `Agent entrypoint raised for example ${example.exampleId}: ${String(error)}`,
              );
            }
          }),
        ),
      );
    } finally {
      provider.restoreActive(previousTracer);
      provider.deregister(offlineTracer);
      // shutdown() flushes pending spans before tearing down the exporter.
      await offlineTracer._tracerProvider.shutdown();
    }

    return Object.fromEntries(processor.exampleTraceIds);
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
      concurrency = 1,
    } = options;

    if (assertTest && !passConditionFn) {
      throw new Error(
        "assertTest=true requires a passConditionFn to decide whether each row passes.",
      );
    }
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new Error(
        `concurrency must be an integer >= 1, got ${concurrency}`,
      );
    }

    const version = await this.resolveDatasetVersion(
      testConfig,
      datasetVersion,
    );
    const versionNumber = Number(version.version_number ?? 0);
    const examples = await this.fetchExamples(testConfig, versionNumber);
    displayStart(testConfig.name, this._projectName, examples.length);
    Logger.info(
      `Dataset version ${versionNumber}: ${examples.length} example(s)`,
    );

    // Pin the run to the exact version the examples were fetched from.
    const pinnedVersion =
      typeof datasetVersion === "string" ? datasetVersion : versionNumber;

    let agentTraces: Record<string, string> = {};
    if (agentFunction && examples.length > 0) {
      agentTraces = await this.runAgent(agentFunction, examples, concurrency);
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

    const results = buildResults(items, agentTraces, passConditionFn);
    if (passConditionFn) {
      await this.reportSuccess(testRunId, prepared, items, results);
    }

    displayResults(results, uiResultsUrl || undefined);

    const outcome: OfflineTestResult = {
      testRunId,
      status,
      uiResultsUrl: uiResultsUrl || undefined,
      results,
      agentOfflineTraceIds: agentTraces,
      passed: computePassed(results),
    };

    if (assertTest) assertAllPassed(outcome);
    return outcome;
  }
}
