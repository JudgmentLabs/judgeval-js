import { afterEach, describe, expect, test } from "bun:test";
import { JudgevalAPIError, JudgevalJqlClient } from "./client";
import { eq, traces } from "./index";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("emits the canonical session-to-trace-ids JSON", () => {
  expect(traces().where(eq("session", "session-1")).ids().toJSON()).toEqual({
    op: "query",
    source: "traces",
    filter: { op: "eq", field: "session", value: "session-1" },
    select: { op: "ids" },
  });
});

test("sends only public query fields and tenant headers", async () => {
  let request: Request | undefined;
  globalThis.fetch = ((input, init) => {
    request =
      input instanceof Request
        ? input
        : new Request(input instanceof URL ? input.toString() : input, init);
    return Promise.resolve(
      new Response(
        JSON.stringify({
          query_id: "q-1",
          rows: [{ trace_id: "trace-1" }],
          row_count: 1,
          elapsed_ms: 4,
        }),
        { status: 200 },
      ),
    );
  }) as typeof fetch;
  const client = new JudgevalJqlClient(
    "https://api.example.com/",
    "api-key",
    "org-1",
    "project-1",
  );

  const response = await client.query(
    traces().where(eq("session", "session-1")).ids(),
    { limit: 25 },
  );

  expect(request?.url).toBe(
    "https://api.example.com/v1/projects/project-1/query",
  );
  expect(request?.headers.get("Authorization")).toBe("Bearer api-key");
  expect(request?.headers.get("X-Organization-Id")).toBe("org-1");
  expect(await request?.json()).toEqual({
    query: {
      op: "query",
      source: "traces",
      filter: { op: "eq", field: "session", value: "session-1" },
      select: { op: "ids" },
    },
    limit: 25,
  });
  expect(response.rows).toEqual([{ trace_id: "trace-1" }]);
});

describe("public JQL errors", () => {
  test("preserves typed error details and Retry-After", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: "JQL_RATE_LIMITED",
            message: "Retry later.",
            hint: "Slow down.",
          }),
          { status: 429, headers: { "Retry-After": "2" } },
        ),
      )) as unknown as typeof fetch;
    const client = new JudgevalJqlClient(
      "https://api.example.com",
      "api-key",
      "org-1",
      "project-1",
    );

    try {
      await client.query(traces().ids());
      throw new Error("expected query to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(JudgevalAPIError);
      expect(error).toMatchObject({
        status: 429,
        code: "JQL_RATE_LIMITED",
        hint: "Slow down.",
        retryAfterSeconds: 2,
      });
    }
  });
});
