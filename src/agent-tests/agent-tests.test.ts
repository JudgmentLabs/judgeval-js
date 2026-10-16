import { afterEach, expect, spyOn, test } from "bun:test";
import type { JudgmentApiClient } from "../internal/api/client";
import { AgentTestRunsFactory, AgentTestsFactory } from ".";

const fakeClient = {
  getApiKey: () => "key",
  getOrganizationId: () => "org",
  getBaseUrl: () => "http://localhost:9999",
} as unknown as JudgmentApiClient;

const BASE = "http://localhost:9999/v1/projects/p1/tests";

afterEach(() => {
  spyOn(globalThis, "fetch").mockRestore();
});

test("routes each call to its v1 tests endpoint", async () => {
  const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
    (async () => new Response("{}")) as unknown as typeof fetch,
  );
  const tests = new AgentTestsFactory(fakeClient, "p1", "proj");
  const runs = new AgentTestRunsFactory(fakeClient, "p1", "proj");

  await tests.create({ name: "t" });
  await tests.listCases("t1", { version: "draft" });
  await tests.updateCase("t1", "c1", { input: {} });
  await tests.createDraft("t1");
  await runs.start("t1", { candidate: "sha" });
  await runs.results("r1");

  expect(
    fetchSpy.mock.calls.map(([url, init]) => [
      String(url),
      init?.method,
      init?.body ?? null,
    ]),
  ).toEqual([
    [BASE, "POST", '{"name":"t"}'],
    [`${BASE}/t1/cases?offset=0&limit=100&version=draft`, "GET", null],
    [`${BASE}/t1/cases/c1`, "PUT", '{"input":{}}'],
    [`${BASE}/t1/draft`, "POST", "{}"],
    [`${BASE}/t1/runs`, "POST", '{"candidate":"sha"}'],
    [`${BASE}/runs/r1/results`, "GET", null],
  ]);
});
