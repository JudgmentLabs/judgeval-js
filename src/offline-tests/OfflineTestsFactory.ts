import type { JudgmentApiClient } from "../internal/api/client";
import type { CreateTestConfigRequest } from "../internal/api/models";
import { Logger } from "../utils/logger";
import { OfflineTestRunner, type OfflineRunOptions } from "./OfflineTestRunner";
import {
  type OfflineTestResult,
  type TestConfig,
  testConfigFromDict,
} from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** A judge to attach to a test config: a judge name, or `{ judgeId }` / `{ name }`. */
export type JudgeRef = string | { judgeId?: string; name?: string };

/**
 * Create test configs and execute offline test runs. Access via
 * `client.offlineTests`. A *test config* pairs a dataset with a set of platform
 * judges; a *test run* evaluates one dataset version and stores per-example
 * results.
 *
 * @example
 * ```typescript
 * const config = await client.offlineTests.createConfig("nightly", "golden-set", [
 *   "helpfulness",
 *   "faithfulness",
 * ]);
 * const result = await client.offlineTests.run("nightly");
 * console.log(result?.uiResultsUrl);
 * ```
 */
export class OfflineTestsFactory {
  private readonly _client: JudgmentApiClient;
  private readonly _projectId: string | null;
  private readonly _projectName: string;

  constructor(
    client: JudgmentApiClient,
    projectId: string | null,
    projectName: string,
  ) {
    this._client = client;
    this._projectId = projectId;
    this._projectName = projectName;
  }

  /**
   * Create a test config binding a dataset to a set of judges.
   *
   * @param name - Name for the test config.
   * @param dataset - Dataset name or dataset id.
   * @param judges - Judges to attach (judge names, or `{ judgeId }` / `{ name }`).
   * @param description - Optional human-readable description.
   */
  async createConfig(
    name: string,
    dataset: string,
    judges: JudgeRef[],
    description?: string,
  ): Promise<TestConfig | null> {
    const projectId = this._expectProjectId();
    if (!projectId) return null;

    const judgeEntries: { judge_id?: string; name?: string }[] = [];
    for (const judge of judges) {
      if (typeof judge === "string") {
        judgeEntries.push(
          isUuid(judge) ? { judge_id: judge } : { name: judge },
        );
      } else if (judge.judgeId) {
        judgeEntries.push({ judge_id: judge.judgeId });
      } else if (judge.name) {
        judgeEntries.push({ name: judge.name });
      } else {
        throw new Error(
          "judges entries must be judge names or objects with a 'judgeId' or 'name'",
        );
      }
    }

    const payload: CreateTestConfigRequest = { name, judges: judgeEntries };
    if (description !== undefined) payload.description = description;
    if (isUuid(dataset)) {
      payload.dataset_id = dataset;
    } else {
      payload.dataset_name = dataset;
    }

    const response = await this._client.postV1projectsTestConfigs(
      projectId,
      payload,
    );
    Logger.info(`Created test config ${name}`);
    return testConfigFromDict(
      (response.test_config as Record<string, unknown> | undefined) ?? {},
    );
  }

  /** Fetch a test config by id (UUID) or name. */
  async getConfig(testConfig: string): Promise<TestConfig | null> {
    const projectId = this._expectProjectId();
    if (!projectId) return null;

    if (isUuid(testConfig)) {
      const response =
        await this._client.getV1projectsTestConfigsByTestConfigId(
          projectId,
          testConfig,
        );
      return testConfigFromDict(
        (response.test_config as Record<string, unknown> | undefined) ?? {},
      );
    }

    const configs = (await this.listConfigs()) ?? [];
    const match = configs.find((config) => config.name === testConfig);
    if (!match) {
      Logger.error(`Test config '${testConfig}' not found`);
      return null;
    }
    return match;
  }

  /** List test configs in the project, optionally filtered to one dataset. */
  async listConfigs(datasetId?: string): Promise<TestConfig[] | null> {
    const projectId = this._expectProjectId();
    if (!projectId) return null;

    const response = await this._client.getV1projectsTestConfigs(
      projectId,
      datasetId,
    );
    const rows = Array.isArray(response.test_configs)
      ? response.test_configs
      : [];
    return rows.map((row) =>
      testConfigFromDict(row as Record<string, unknown>),
    );
  }

  /** Delete a test config by id. Returns `false` if the project is unresolved. */
  async deleteConfig(testConfigId: string): Promise<boolean> {
    const projectId = this._expectProjectId();
    if (!projectId) return false;

    await this._client.deleteV1projectsTestConfigsByTestConfigId(
      projectId,
      testConfigId,
    );
    Logger.info(`Deleted test config ${testConfigId}`);
    return true;
  }

  /**
   * Run an offline test for a test config.
   *
   * Without `agentFunction`, the judges score each example's existing trace.
   * With `agentFunction`, the agent runs once per example first and the judges
   * score the resulting agent trace.
   *
   * @param testConfig - Test config name, id, or `TestConfig` object.
   * @param options - Run options (agent function, judge versions, dataset
   *   version, pass condition, assert, timeout).
   */
  async run(
    testConfig: string | TestConfig,
    options: OfflineRunOptions = {},
  ): Promise<OfflineTestResult | null> {
    const projectId = this._expectProjectId();
    if (!projectId) return null;

    const config =
      typeof testConfig === "string"
        ? await this.getConfig(testConfig)
        : testConfig;
    if (!config || !config.id) return null;

    const runner = new OfflineTestRunner(
      this._client,
      projectId,
      this._projectName,
    );
    return runner.run(config, options);
  }

  private _expectProjectId(): string | null {
    if (!this._projectId) {
      Logger.error(
        "Project ID is not resolved. Offline-test operations require a valid project.",
      );
      return null;
    }
    return this._projectId;
  }
}
