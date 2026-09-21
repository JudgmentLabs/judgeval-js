# Judgeval TypeScript SDK

[![npm version](https://badge.fury.io/js/judgeval.svg)](https://www.npmjs.com/package/judgeval)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Installation

Find the latest version on [npm](https://www.npmjs.com/package/judgeval).

```bash
npm install judgeval
```

## Usage

### Tracer

```typescript
import { Tracer } from "judgeval";

const tracer = await Tracer.init({
  projectName: "my-llm-app",
});

async function chatWithUser(userMessage: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: userMessage }],
  });
  return response.choices[0].message.content || "";
}

const tracedChat = Tracer.observe(chatWithUser);
const result = await tracedChat("What is the capital of France?");

await Tracer.shutdown();
```

### Async Evaluation

Trigger server-side evaluation on the current span:

```typescript
import { Tracer } from "judgeval";

const tracedChat = Tracer.observe(async (userMessage: string) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: userMessage }],
  });

  Tracer.asyncEvaluate({ judge: "Relevancy" });

  return response.choices[0].message.content || "";
});

await tracedChat("What is the capital of France?");
```

### Virtual SQL

Use `sql()` for read-only queries against Judgment's virtual SQL catalog. Call
`discoverSchema()` for the same Markdown reference as MCP `discover_schema`:
tables, column types and descriptions, examples, and query limits.

```typescript
import { Judgeval } from "judgeval";

const client = await Judgeval.create({ projectName: "my-llm-app" });
console.log(await client.discoverSchema());
const result = await client.sql("SELECT count() AS run_count FROM telemetry.traces");
console.log(result.rows);
```

SQL execution requires organization viewer access, a resolved project, and public
query access enabled for your organization. Results contain `catalog_version`,
`columns`, `rows`, `row_count`, and `elapsed_ms`, with a maximum of 1,000 rows and
5 MiB. Integers outside JavaScript's safe range remain exact decimal strings,
including nested values; use `BigInt(value)` when needed. Both methods accept
`{ signal }` for cancellation and preserve `JudgevalAPIError` details.

Schema discovery uses `GET /v1/sql/schema` and returns no project data. It needs
no resolved project or public query opt-in. Query execution uses
`POST /v1/projects/{projectId}/sql` with `{ "sql": "..." }`; the server enforces
tenant scope. Use SQL predicates and `LIMIT` instead of JQL scope options.
See the [Virtual SQL guide](https://docs.judgmentlabs.ai/documentation/mcp-and-agent-tools/virtual-sql)
for query and migration examples.

### Legacy JQL

JQL guidance is deprecated for new integrations. Existing `query()`, `present()`,
and `discover(kind)` calls remain supported. Use `sql()` for new queries and render
its rows in your application; `discoverSchema()` returns the SQL reference,
while legacy `discover(kind)` queries project-specific values.

Build JQL with the `judgeval/jql` entry point and run it through the authenticated
Judgeval client. Organization and project scope come from the client, never from
the query payload.

```typescript
import { Judgeval } from "judgeval";
import { spans } from "judgeval/jql";

const client = await Judgeval.create({ projectName: "my-llm-app" });
const result = await client.query(spans().rows(), {
  traceIds: ["trace-123"],
});
```

`traceIds` and `sessionIds` are mutually exclusive options outside the JQL query
object. Trace IDs narrow the query directly. Judgment resolves session IDs within
the authenticated organization and project, then narrows every part of the query
to their traces. If no session resolves, the request fails instead of falling back
to the whole project. Both options work with `present` and `discover`.

## Documentation

- [Full Documentation](https://docs.judgmentlabs.ai/)

## License

Apache 2.0
