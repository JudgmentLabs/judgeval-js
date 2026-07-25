import { afterEach, describe, expect, test } from "bun:test";
import {
  JudgevalAPIError,
  JudgevalJqlClient,
  JudgevalJqlUnavailableError,
} from "./client";
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

  const respondNotFound = (message: string) => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "Resource not found", message }), {
          status: 404,
        }),
      )) as unknown as typeof fetch;
  };

  const jqlClient = () =>
    new JudgevalJqlClient(
      "https://api.example.com",
      "api-key",
      "org-1",
      "project-1",
      "demo",
    );

  test("explains the feature gate and the missing project on an opaque 404", async () => {
    respondNotFound("Resource not found");

    try {
      await jqlClient().query(traces().ids());
      throw new Error("expected query to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(JudgevalJqlUnavailableError);
      // Existing callers that catch JudgevalAPIError keep working.
      expect(error).toBeInstanceOf(JudgevalAPIError);
      const { message } = error as JudgevalJqlUnavailableError;
      expect(message).toContain("JQL is not enabled for this organization");
      expect(message).toContain("project 'demo' was not found");
      expect(message).toContain("Contact Judgment");
      // The opaque server message must not survive as the user-facing message.
      expect(message).not.toContain("Resource not found");
      expect(error).toMatchObject({ status: 404 });
    }
  });

  test("does not blame the feature gate when the project is missing", async () => {
    respondNotFound("Project not found");

    try {
      await jqlClient().query(traces().ids());
      throw new Error("expected query to fail");
    } catch (error) {
      const { message } = error as JudgevalJqlUnavailableError;
      expect(message).toBe(
        "Project 'demo' was not found for this organization.",
      );
      expect(message).not.toContain("not enabled");
    }
  });

  test("falls back to the project id when no project name is supplied", async () => {
    respondNotFound("Resource not found");
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
      expect((error as JudgevalJqlUnavailableError).message).toContain(
        "project 'project-1' was not found",
      );
    }
  });

  test("leaves non-404 errors as plain API errors", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ error: "JQL_INVALID", message: "boom" }),
          {
            status: 422,
          },
        ),
      )) as unknown as typeof fetch;

    try {
      await jqlClient().query(traces().ids());
      throw new Error("expected query to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(JudgevalAPIError);
      expect(error).not.toBeInstanceOf(JudgevalJqlUnavailableError);
      expect((error as JudgevalAPIError).message).toBe("boom");
    }
  });
});
