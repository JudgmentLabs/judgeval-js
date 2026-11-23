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
  /** Why the check expects this value, shown next to its verdict. Judges never read it. */
  rationale?: string;
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

/** One canned tool result: `return` answers a call whose arguments include `match`. */
export interface EnvironmentToolRule {
  /** Arguments a call must have for the rule to answer it; omit to answer every call. */
  match?: Record<string, unknown>;
  /** What the tool returns in place of running. */
  return: unknown;
}

/** What a test environment holds: data only, never code. */
export interface EnvironmentDefinition {
  /** Canned results by tool name; the first rule that matches a call answers it. */
  tools?: Record<string, EnvironmentToolRule[]>;
  /** Starting data, in whatever shape your test runner applies before a case. */
  seed?: Record<string, unknown>;
}

export interface StartedEnvironment {
  description: string | null;
  definition: EnvironmentDefinition;
}

export interface StartedCase {
  case_id: string;
  input: unknown;
  /** Headers that tag a deployed agent's trace with this run and case. */
  headers: Record<string, string>;
  /**
   * The test environment the case names in `metadata.environment`, as
   * `name@version` and a key of the run's `environments`; `null` when it names
   * none. Present only when test environments are enabled.
   */
  environment?: string | null;
}

export interface StartedRun {
  run_id: string;
  test_suite_version: number;
  /** Run the agent once per case, with `headers` (or `Tracer.testCase`) tagging its trace. */
  cases: StartedCase[];
  /**
   * The test environments the run's cases name, by `name@version`. Present
   * only when test environments are enabled.
   */
  environments?: Record<string, StartedEnvironment>;
}

export interface TestEnvironment {
  name: string;
  version: number;
  description: string | null;
  created_at: string;
  definition: EnvironmentDefinition;
}

/** What `cannedToolResult` returns when no rule answers the call. */
export const NO_MATCH: unique symbol = Symbol("NO_MATCH");

const hasOwn = (object: object, key: string) =>
  Object.prototype.hasOwnProperty.call(object, key);

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        hasOwn(b, key) &&
        deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
    )
  );
}

/**
 * Return what a test environment says a tool call returns, or `NO_MATCH`.
 *
 * The first rule for `toolName` whose `match` is a subset of `args` answers
 * the call with its `return`; a rule with no `match` answers every call.
 * Nested values must be equal: arrays in order, objects key by key. Compare
 * the result to `NO_MATCH` with `===`, since a rule may return `null`.
 *
 * @example
 * ```typescript
 * let result = cannedToolResult(definition, name, args);
 * if (result === NO_MATCH) result = await realTools[name](args);
 * ```
 */
export function cannedToolResult(
  definition: EnvironmentDefinition,
  toolName: string,
  args: Record<string, unknown>,
): unknown {
  const tools = definition.tools ?? {};
  const rules = hasOwn(tools, toolName) ? tools[toolName] : [];
  const rule = rules.find((rule) =>
    Object.entries(rule.match ?? {}).every(
      ([key, value]) => hasOwn(args, key) && deepEqual(args[key], value),
    ),
  );
  return rule ? rule.return : NO_MATCH;
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
    checks: (Omit<CaseCheck, "rationale"> & {
      judge_id: string;
      /** The case check's rationale at the run's test suite version. */
      rationale: string | null;
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
  protected readonly _resource: string = "test-suites";

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
      `${this._client.getBaseUrl()}/v1/projects/${this._projectId}/${this._resource}${path}`,
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
 * Create and read test environments. Access via `judgeval.testEnvironments`.
 *
 * A test environment is the world a test case runs in: canned tool results
 * and starting data, stored as an immutable `name@version`. A case names one
 * in its `metadata.environment`; `judgeval.testRuns.start` then returns the
 * definition for your test runner to apply.
 *
 * Test environments must be enabled for your organization.
 *
 * @example
 * ```typescript
 * await judgeval.testEnvironments.create({
 *   name: "ticket-service-down",
 *   definition: {
 *     tools: {
 *       create_ticket: [{ return: { error: "service unavailable" } }],
 *       lookup_order: [
 *         { match: { order_id: "A1" }, return: { status: "shipped" } },
 *       ],
 *     },
 *     seed: { orders: [{ order_id: "A1" }] },
 *   },
 * });
 * await judgeval.testSuites.addCases(testSuiteId, [
 *   {
 *     input: { prompt: "Where is order A1?" },
 *     metadata: { environment: "ticket-service-down@1" },
 *   },
 * ]);
 * ```
 */
export class TestEnvironmentsFactory extends ProjectTestSuitesClient {
  protected override readonly _resource = "test-environments";

  /**
   * Create a test environment as its version 1.
   *
   * `name` takes lowercase letters, digits, `-` and `_`. Do not store
   * credentials in `definition`.
   */
  create(environment: {
    name: string;
    definition: EnvironmentDefinition;
    description?: string;
  }): Promise<TestEnvironment> {
    return this.call("POST", "", { body: environment });
  }

  /** Add the next version. Earlier versions never change. */
  addVersion(
    name: string,
    version: { definition: EnvironmentDefinition; description?: string },
  ): Promise<TestEnvironment> {
    return this.call("POST", `/${name}/versions`, { body: version });
  }

  /** List the latest version of each environment, without definitions. */
  list(): Promise<{
    test_environments: Omit<TestEnvironment, "definition">[];
  }> {
    return this.call("GET", "");
  }

  /** Get one version of an environment with its `definition`. */
  get(name: string, version: number): Promise<TestEnvironment> {
    return this.call("GET", `/${name}/versions/${version}`);
  }
}

/**
 * Run test suites and read results. Access via `judgeval.testRuns`.
 *
 * A case that names a test environment carries it as `c.environment`, a key
 * of `run.environments`. Load that definition's `seed` before the case, and
 * answer its tool calls with `cannedToolResult`.
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
  /**
   * Start a run of the test suite's latest published version.
   *
   * With `stored_traces: true` each case's stored trace, named by its
   * `metadata.trace_id`, is scored instead of running the agent. Every
   * published case needs a trace in this project.
   */
  start(
    testSuiteId: string,
    options: {
      case_filter?: CaseFilter;
      candidate?: string;
      candidate_meta?: Record<string, unknown>;
      trigger?: "manual" | "ci" | "schedule" | "api";
      stored_traces?: boolean;
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
