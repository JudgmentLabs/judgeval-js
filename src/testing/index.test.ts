import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { JudgmentApiClient } from "../internal/api/client";
import { Logger } from "../utils/logger";
import {
  NO_MATCH,
  TestEnvironmentsFactory,
  TestRunsFactory,
  TestSuitesFactory,
  cannedToolResult,
} from "./index";

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
    const calls = stubFetch({ run_id: "r1", test_suite_version: 2, cases: [] });
    await new TestRunsFactory(client, "p1", "proj").start("t1", {
      candidate: "abc123",
      stored_traces: true,
    });
    expect(calls).toEqual([
      {
        url: "https://api.example.com/v1/projects/p1/test-suites/t1/runs",
        method: "POST",
        body: JSON.stringify({ candidate: "abc123", stored_traces: true }),
      },
    ]);
  });
});

test("cannedToolResult returns the first matching rule", () => {
  const definition = {
    tools: {
      lookup_order: [
        { match: { order_id: "A1", fields: ["status"] }, return: null },
        { match: { order_id: "A1" }, return: { status: "shipped" } },
        { match: { filter: { a: 1, b: [2] } }, return: "filtered" },
        { match: { note: null }, return: "noted" },
        { return: { error: "not found" } },
      ],
    },
  };
  const result = (toolName: string, args: Record<string, unknown>) =>
    cannedToolResult(definition, toolName, args);

  expect([
    result("lookup_order", { order_id: "A1", fields: ["status"] }),
    result("lookup_order", { order_id: "A1", fields: [] }),
    result("lookup_order", { filter: { b: [2], a: 1 } }),
    result("lookup_order", { filter: { a: 1, b: [2], c: 3 } }),
    result("lookup_order", { order_id: "B2" }),
    result("create_ticket", { order_id: "A1" }),
    result("toString", {}),
  ]).toEqual([
    null,
    { status: "shipped" },
    "filtered",
    { error: "not found" },
    { error: "not found" },
    NO_MATCH,
    NO_MATCH,
  ]);
});

test("cannedToolResult returns a copy that does not share the rule's objects", () => {
  const canned = { orders: [{ id: "A1" }] };
  const definition = { tools: { list_orders: [{ return: canned }] } };
  const result = cannedToolResult(definition, "list_orders", {});
  canned.orders[0].id = "changed";
  expect(result).toEqual({ orders: [{ id: "A1" }] });
});

describe("TestEnvironmentsFactory", () => {
  test("get reads one version from the test environments route", async () => {
    const calls = stubFetch({});
    await new TestEnvironmentsFactory(client, "p1", "proj").get("refunds", 2);
    expect(calls).toEqual([
      {
        url: "https://api.example.com/v1/projects/p1/test-environments/refunds/versions/2",
        method: "GET",
        body: undefined,
      },
    ]);
  });
});

describe("TestSuitesFactory", () => {
  test("a missing project fails before calling the API", async () => {
    const calls = stubFetch({});
    const error = await new TestSuitesFactory(client, null, "proj")
      .list()
      .catch((e: Error) => e.message);
    expect({ error, calls }).toEqual({
      error: "Project 'proj' not found",
      calls: [],
    });
  });

  test("an id that leaves the test suites route is rejected", async () => {
    const calls = stubFetch({});
    const error = await new TestSuitesFactory(client, "p1", "proj")
      .delete("../../projects/p2")
      .catch((e: Error) => e.message);
    expect({ error, calls }).toEqual({
      error: "Invalid id in API path: /../../projects/p2",
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
