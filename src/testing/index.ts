import type { JudgmentApiClient } from "../internal/api/client";

/** How a judge's output must compare to `expected` for the check to pass. */
export type CheckOp =
  | "eq"
  | "ne"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "in"
  | "not_in";

/** One judge to run on a case's trace, keyed by judge id in `expected`. */
export interface CaseCheck {
  judge_major_version: number;
  judge_minor_version: number;
  op: CheckOp;
  /** The golden value; a list for `in` and `not_in`. */
  expected: unknown;
}

export interface TestCaseInput {
  /** What the agent gets. */
  input: unknown;
  /** The case's checks, keyed by lowercase judge id. */
  expected?: Record<string, CaseCheck>;
  name?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface TestCase extends Required<TestCaseInput> {
  case_id: string;
  version_added: number;
}

export interface TestSuite {
  test_suite_id: string;
  name: string;
  description: string | null;
  labels: string[];
  /** The latest published version; 0 before the first publish. */
  version: number;
  created_at: string;
  updated_at: string;
}

export type CaseFilter =
  | { kind: "all" }
  | { kind: "tags"; tags: string[] }
  | { kind: "case_ids"; case_ids: string[] }
  | { kind: "last_failures"; run_id: string };

export interface StartedRun {
  run_id: string;
  test_suite_version: number;
  /** Run the agent once per case, with `headers` (or `Tracer.testCase`) tagging its trace. */
  cases: { case_id: string; input: unknown; headers: Record<string, string> }[];
}

export interface TestRun {
  run_id: string;
  test_suite_id: string;
  test_suite_version: number;
  scored_from_run_id: string | null;
  candidate: string | null;
  candidate_meta: Record<string, unknown>;
  trigger: string;
  case_filter: CaseFilter;
  cases_total: number;
  cases_with_output: number;
  cases_scored: number;
  cases_passed: number;
  created_at: string;
}

export interface TestResults {
  results: {
    case_id: string;
    trace_id: string | null;
    scored_at: string | null;
    passed: boolean | null;
    checks: (CaseCheck & {
      judge_id: string;
      judge_output: unknown;
      passed: boolean;
      reason: string | null;
      error_message: string | null;
    })[];
  }[];
}

type Page<K extends string, T> = { [key in K]: T[] } & {
  next_offset: number | null;
};

class ProjectTestSuitesClient {
  constructor(
    protected readonly _client: JudgmentApiClient,
    protected readonly _projectId: string | null,
    protected readonly _projectName: string,
  ) {}

  // TODO: switch to the generated client once it covers these routes (#94).
  protected async call<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    options: { body?: unknown; query?: Record<string, string | number> } = {},
  ): Promise<T> {
    // Ids land in the path, so "..", "?" or "#" could reach another route.
    if (!/^(\/[\w-]+)*$/.test(path)) {
      throw new Error(`Invalid id in API path: ${path}`);
    }
    if (!this._projectId) {
      throw new Error(`Project '${this._projectName}' not found`);
    }
    const url = new URL(
      `${this._client.getBaseUrl()}/v1/projects/${this._projectId}/test-suites${path}`,
    );
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this._client.getApiKey()}`,
        "X-Organization-Id": this._client.getOrganizationId(),
      },
      body: method === "GET" ? undefined : JSON.stringify(options.body ?? {}),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return (await response.json()) as T;
  }
}

/**
 * Create test suites and edit their cases. Access via `judgeval.testSuites`.
 *
 * Cases change only in a suite's draft (version + 1). New cases go straight
 * into the draft; to edit or remove published cases, call `createDraft` first.
 * `publish` freezes the draft as the next version.
 */
export class TestSuitesFactory extends ProjectTestSuitesClient {
  create(testSuite: {
    name: string;
    description?: string;
    labels?: string[];
  }): Promise<TestSuite> {
    return this.call("POST", "", { body: testSuite });
  }

  list(offset = 0, limit = 50): Promise<Page<"test_suites", TestSuite>> {
    return this.call("GET", "", { query: { offset, limit } });
  }

  delete(testSuiteId: string): Promise<{ test_suite_id: string }> {
    return this.call("DELETE", `/${testSuiteId}`);
  }

  /** Cases in a published version (default: the latest) or the draft. */
  listCases(
    testSuiteId: string,
    options: {
      version?: number | "draft";
      offset?: number;
      limit?: number;
    } = {},
  ): Promise<Page<"cases", TestCase> & { version: number }> {
    const { version, offset = 0, limit = 100 } = options;
    return this.call("GET", `/${testSuiteId}/cases`, {
      query: { offset, limit, ...(version !== undefined && { version }) },
    });
  }

  /** Add cases to the draft. Returns their ids in order. */
  addCases(
    testSuiteId: string,
    cases: TestCaseInput[],
  ): Promise<{ case_ids: string[] }> {
    return this.call("POST", `/${testSuiteId}/cases`, { body: { cases } });
  }

  /** Replace a case in the draft. Call `createDraft` first for published cases. */
  updateCase(
    testSuiteId: string,
    caseId: string,
    testCase: TestCaseInput,
  ): Promise<{ case_id: string }> {
    return this.call("PUT", `/${testSuiteId}/cases/${caseId}`, {
      body: testCase,
    });
  }

  /** Remove a case from the draft. Call `createDraft` first for published cases. */
  removeCase(
    testSuiteId: string,
    caseId: string,
  ): Promise<{ case_id: string }> {
    return this.call("DELETE", `/${testSuiteId}/cases/${caseId}`);
  }

  /** Copy the published cases into the draft so they can be edited. */
  createDraft(testSuiteId: string): Promise<{ version: number }> {
    return this.call("POST", `/${testSuiteId}/draft`);
  }

  /** Freeze the draft as the next version. */
  publish(testSuiteId: string): Promise<{ version: number }> {
    return this.call("POST", `/${testSuiteId}/publish`);
  }

  /** Throw away the draft's changes. */
  discard(testSuiteId: string): Promise<{ discarded: boolean }> {
    return this.call("POST", `/${testSuiteId}/discard`);
  }
}

/**
 * Run test suites and read results. Access via `judgeval.testRuns`.
 *
 * @example
 * ```typescript
 * const run = await judgeval.testRuns.start(testSuiteId, { candidate: process.env.GIT_SHA });
 * await Promise.all(
 *   run.cases.map((c) => Tracer.testCase(run.run_id, c.case_id, () => agent(c.input))),
 * );
 * const { results } = await judgeval.testRuns.results(run.run_id);
 * ```
 */
export class TestRunsFactory extends ProjectTestSuitesClient {
  /** Start a run of the test suite's latest published version. */
  start(
    testSuiteId: string,
    options: {
      case_filter?: CaseFilter;
      candidate?: string;
      candidate_meta?: Record<string, unknown>;
      trigger?: "manual" | "ci" | "schedule" | "api";
    } = {},
  ): Promise<StartedRun> {
    return this.call("POST", `/${testSuiteId}/runs`, { body: options });
  }

  list(
    testSuiteId: string,
    offset = 0,
    limit = 50,
  ): Promise<Page<"runs", TestRun>> {
    return this.call("GET", `/${testSuiteId}/runs`, {
      query: { offset, limit },
    });
  }

  get(runId: string): Promise<TestRun> {
    return this.call("GET", `/runs/${runId}`);
  }

  results(runId: string): Promise<TestResults> {
    return this.call("GET", `/runs/${runId}/results`);
  }

  /**
   * Trigger scoring of an existing run's traces with the latest published
   * version. Returns the new run right away; its cases are scored in the
   * background, so poll `get`.
   */
  score(runId: string): Promise<{ run_id: string }> {
    return this.call("POST", `/runs/${runId}/score`);
  }
}
