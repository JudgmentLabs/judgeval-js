import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { JudgmentApiClient } from "../internal/api/client";
import { Logger } from "../utils/logger";
import { TestRunsFactory, TestsFactory } from "./index";

const client = {
  getBaseUrl: () => "https://api.example.com",
  getApiKey: () => "key",
  getOrganizationId: () => "org",
} as unknown as JudgmentApiClient;

function stubFetch(body: unknown) {
  const calls: { url: string; method: string; body?: string }[] = [];
  globalThis.fetch = mock((url: URL | string, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: init?.body as string | undefined,
    });
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  }) as unknown as typeof fetch;
  return calls;
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("TestRunsFactory", () => {
  test("start posts the options to the test's runs", async () => {
    const calls = stubFetch({ run_id: "r1", test_version: 2, cases: [] });
    await new TestRunsFactory(client, "p1", "proj").start("t1", {
      candidate: "abc123",
    });
    expect(calls).toEqual([
      {
        url: "https://api.example.com/v1/projects/p1/tests/t1/runs",
        method: "POST",
        body: JSON.stringify({ candidate: "abc123" }),
      },
    ]);
  });

  test("list sends offset and limit as query params", async () => {
    const calls = stubFetch({ runs: [], next_offset: null });
    await new TestRunsFactory(client, "p1", "proj").list("t1", 10, 5);
    expect(calls.map((call) => call.url)).toEqual([
      "https://api.example.com/v1/projects/p1/tests/t1/runs?offset=10&limit=5",
    ]);
  });
});

describe("TestsFactory", () => {
  test("a missing project fails before calling the API", async () => {
    const calls = stubFetch({});
    const error = await new TestsFactory(client, null, "proj")
      .list()
      .catch((e: Error) => e.message);
    expect({ error, calls }).toEqual({
      error: "Project 'proj' not found",
      calls: [],
    });
  });
});

test("the offline-tests deprecation is logged once", async () => {
  // A fresh module copy, since other tests may already have logged it.
  const freshModule: string = "../offline-tests/deprecation?fresh";
  const { OFFLINE_TESTS_DEPRECATION, warnOfflineTestsDeprecated } =
    (await import(
      freshModule
    )) as typeof import("../offline-tests/deprecation");
  const warning = spyOn(Logger, "warning").mockImplementation(() => {});
  warnOfflineTestsDeprecated();
  warnOfflineTestsDeprecated();
  expect(warning.mock.calls).toEqual([[OFFLINE_TESTS_DEPRECATION]]);
  warning.mockRestore();
});
