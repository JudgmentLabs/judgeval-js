# Judgeval TypeScript SDK

[![npm version](https://badge.fury.io/js/judgeval.svg)](https://www.npmjs.com/package/judgeval)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Installation

Find the latest version on [npm](https://www.npmjs.com/package/judgeval).

```bash
npm install judgeval
```

## Trace your MCP server

See which tools agents call, investigate failures, and group related calls into conversations. Supports `@modelcontextprotocol/sdk` 1.x and `@modelcontextprotocol/server` 2.x.

Initialize your tracer, then instrument your existing server before serving requests:

```typescript
import { Tracer, instrumentMcpServer } from "judgeval";

await Tracer.init({ projectName: "my-mcp-server" });
instrumentMcpServer(server);
```

Tool calls appear as standard Judgment traces, with instrumented work inside each tool captured as child spans. Input/output and error-message capture are opt-in.

By default, the SDK adds optional `intent`, `llm_model`, and `conversation_id` arguments to compatible tool schemas and removes them before your tool runs. Results include a conversation ID for the agent to reuse. To trace without changing tool schemas or results:

```typescript
instrumentMcpServer(server, { injectAgentArguments: false });
```

Call `await Tracer.forceFlush()` before a serverless return, or `await Tracer.shutdown()` when stopping. Export is best-effort and uses your existing tracer.

See the [Judgment documentation](https://docs.judgmentlabs.ai/documentation) for more on tracing and integrations.

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

### SQL

Use `sql()` for read-only queries against Judgment's virtual schema, which
abstracts the underlying storage. The server validates incoming queries,
rejects writes, and enforces organization and project scope. Call
`discoverSchema()` for the same Markdown reference as MCP `discover_schema`:
tables, column types and descriptions, examples, and query limits.

```typescript
import { Judgeval } from "judgeval";

const client = await Judgeval.create({ projectName: "my-llm-app" });
console.log(await client.discoverSchema());
const result = await client.sql("SELECT count() AS run_count FROM telemetry.traces");
console.log(result.rows);
```

SQL execution requires organization viewer access and a resolved project. Results contain `catalog_version`,
`columns`, `rows`, `row_count`, and `elapsed_ms`, with a maximum of 1,000 rows and
5 MiB. Integers outside JavaScript's safe range remain exact decimal strings,
including nested values; use `BigInt(value)` when needed. Both methods accept
`{ signal }` for cancellation and preserve `JudgevalAPIError` details.

Schema discovery uses `GET /v1/sql/schema` and returns no project data. It needs
no resolved project. Query execution uses
`POST /v1/projects/{projectId}/sql` with `{ "sql": "..." }`; the server enforces
tenant scope. Use SQL predicates and `LIMIT` to narrow results.
See the [SQL guide](https://docs.judgmentlabs.ai/documentation/mcp-and-agent-tools/sql)
for query examples.

## Documentation

- [Full Documentation](https://docs.judgmentlabs.ai/)

## License

Apache 2.0
