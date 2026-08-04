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

test("sends session scope with the public query fields and tenant headers", async () => {
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

  const response = await client.query(traces().ids(), {
    limit: 25,
    sessionIds: ["session-1"],
  });

  expect({
    request: {
      url: request?.url,
      authorization: request?.headers.get("Authorization"),
      organizationId: request?.headers.get("X-Organization-Id"),
      body: await request?.json(),
    },
    response,
  }).toEqual({
    request: {
      url: "https://api.example.com/v1/projects/project-1/query",
      authorization: "Bearer api-key",
      organizationId: "org-1",
      body: {
        query: {
          op: "query",
          source: "traces",
          select: { op: "ids" },
        },
        limit: 25,
        session_ids: ["session-1"],
      },
    },
    response: {
      query_id: "q-1",
      rows: [{ trace_id: "trace-1" }],
      row_count: 1,
      elapsed_ms: 4,
    },
  });
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

    const caught = await (async () => {
      try {
        await client.query(traces().ids());
        throw new Error("expected query to fail");
      } catch (error) {
        return error;
      }
    })();
    expect(
      caught instanceof JudgevalAPIError
        ? {
            name: caught.name,
            message: caught.message,
            status: caught.status,
            code: caught.code,
            hint: caught.hint,
            retryAfterSeconds: caught.retryAfterSeconds,
          }
        : caught,
    ).toEqual({
      name: "JudgevalAPIError",
      message: "Retry later.",
      status: 429,
      code: "JQL_RATE_LIMITED",
      hint: "Slow down.",
      retryAfterSeconds: 2,
    });
  });
});
