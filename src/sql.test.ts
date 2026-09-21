import { afterAll, afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { Judgeval, JudgevalAPIError, type SqlResponse } from "./index";
import * as projectResolver from "./utils/resolve-project-id";

const originalFetch = globalThis.fetch;
const resolveProject = spyOn(projectResolver, "resolveProjectId");
afterAll(() => resolveProject.mockRestore());
const SQL = "SELECT count() AS run_count FROM telemetry.traces";
const credentials = {
  "Content-Type": "application/json",
  Authorization: "Bearer api-key",
  "X-Organization-Id": "org-1",
};

beforeEach(() => resolveProject.mockResolvedValue("project /1"));
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function client() {
  return Judgeval.create({
    projectName: "demo",
    apiKey: "api-key",
    organizationId: "org-1",
    apiUrl: "https://api.example.com/",
  });
}

test("forwards scoped SQL and preserves the complete result and exact integer strings", async () => {
  const controller = new AbortController();
  const response: SqlResponse = {
    catalog_version: "1",
    columns: [
      { name: "run_count", type: "UInt64", nullable: false },
      { name: "nested", type: "Array(Int64)", nullable: false },
    ],
    rows: [
      { run_count: "9007199254740993", nested: ["-9223372036854775808", 42] },
    ],
    row_count: 1,
    elapsed_ms: 2,
  };
  const calls: unknown[] = [];
  globalThis.fetch = Object.assign(
    (url: unknown, init?: RequestInit) => {
      calls.push({ url, init, sameSignal: init?.signal === controller.signal });
      return Promise.resolve(Response.json(response));
    },
    { preconnect: originalFetch.preconnect },
  );
  const sdk = await client();
  const result = await sdk.sql(SQL, { signal: controller.signal });
  expect({ result, calls }).toEqual({
    result: response,
    calls: [
      {
        url: "https://api.example.com/v1/projects/project%20%2F1/sql",
        init: {
          method: "POST",
          headers: credentials,
          body: JSON.stringify({ sql: SQL }),
          signal: controller.signal,
        },
        sameSignal: true,
      },
    ],
  });
});

test("returns the schema Markdown without a resolved project or request body", async () => {
  resolveProject.mockRejectedValue(new Error("No project"));
  const reference =
    "# Judgment SQL\n\n## telemetry.traces\ntrace_id: String — Trace ID\n";
  const calls: unknown[] = [];
  globalThis.fetch = Object.assign(
    (url: unknown, init?: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(Response.json({ schema: reference }));
    },
    { preconnect: originalFetch.preconnect },
  );
  const sdk = await client();
  expect({ reference: await sdk.discoverSchema(), calls }).toEqual({
    reference,
    calls: [
      {
        url: "https://api.example.com/v1/sql/schema",
        init: {
          method: "GET",
          headers: credentials,
          body: undefined,
          signal: undefined,
        },
      },
    ],
  });
});

test("rejects SQL without a resolved project before querying", async () => {
  resolveProject.mockRejectedValue(new Error("No project"));
  const calls: unknown[] = [];
  globalThis.fetch = Object.assign(
    (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve(Response.json({}));
    },
    { preconnect: originalFetch.preconnect },
  );
  const sdk = await client();
  let error: unknown;
  try {
    await sdk.sql(SQL);
  } catch (caught) {
    error = caught;
  }
  expect({ error, calls }).toEqual({
    error: new Error("Project must resolve before running queries."),
    calls: [],
  });
});

test.each([
  {
    method: "sql",
    status: 429,
    code: "QUERY_RATE_LIMITED",
    message: "Retry later.",
    hint: "Slow down.",
    retry: 2,
  },
  {
    method: "discoverSchema",
    status: 403,
    code: "Forbidden",
    message: "Organization membership required.",
    hint: "",
    retry: undefined,
  },
] as const)("preserves public API errors for $method", async (scenario) => {
  globalThis.fetch = Object.assign(
    () =>
      Promise.resolve(
        Response.json(
          {
            error: scenario.code,
            message: scenario.message,
            hint: scenario.hint,
          },
          {
            status: scenario.status,
            headers:
              scenario.retry === undefined
                ? {}
                : { "Retry-After": String(scenario.retry) },
          },
        ),
      ),
    { preconnect: originalFetch.preconnect },
  );
  const sdk = await client();
  let error: unknown;
  try {
    await (scenario.method === "sql" ? sdk.sql(SQL) : sdk.discoverSchema());
  } catch (caught) {
    error = caught;
  }
  expect(
    error instanceof JudgevalAPIError
      ? { ...error, message: error.message }
      : error,
  ).toEqual({
    name: "JudgevalAPIError",
    status: scenario.status,
    code: scenario.code,
    message: scenario.message,
    hint: scenario.hint,
    retryAfterSeconds: scenario.retry,
  });
});
