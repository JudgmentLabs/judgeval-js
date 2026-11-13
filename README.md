# Judgeval TypeScript SDK

[![npm version](https://badge.fury.io/js/judgeval.svg)](https://www.npmjs.com/package/judgeval)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Installation

Find the latest version on [npm](https://www.npmjs.com/package/judgeval).

```bash
npm install judgeval
```

## Trace your MCP server

If you build an MCP server, `instrumentMcpServer` shows you how agents use it: which tools they call, what fails and why, and how they move between tools. It works with `@modelcontextprotocol/sdk` 1.x and `@modelcontextprotocol/server` 2.x.

```typescript
import { Tracer, instrumentMcpServer } from "judgeval";

await Tracer.init({ projectName: "my-mcp-server" });

const server = new McpServer({ name: "orders", version: "1.0.0" });
// Register your tools, then:
instrumentMcpServer(server);
```

Requests create normal Judgment OTel spans, using the tracer's environment, sampling and export settings. Calls start new traces unless explicit incoming `params._meta.traceparent` supplies a parent. Instrumented work inside a tool becomes child spans. MCP dashboard rows are derived from completed execution spans, including nested calls; judges/issues operate on the containing trace.

Arguments/results are opt-in (`captureInput`, `captureOutput`); `redactPayload(value, field)` transforms a detached JSON snapshot before export. Throw or return `undefined` to omit a payload. Non-JSON or oversized payloads (128 KiB) are omitted. Telemetry failures never affect a call. Call `await Tracer.forceFlush()` before serverless return, or `await Tracer.shutdown()` when stopping. Delivery uses the existing OTel exporter and is best-effort; a terminated or hung tool may leave no completed span.

Successful calls without an application or echoed conversation session offer a new ID even on stateful HTTP; the transport session groups calls until the agent echoes it. Error results receive no handoff. Dictionary outputs stay unchanged and use supplemental text for handoff.

**What changes on your server:** compatible tools gain optional `intent`, `llm_model` and `conversation_id` arguments, stripped before execution. A missing logical session gets an ID in supplemental text and compatible existing `structuredContent._judgment`, with a matching optional output-schema property. Text-only results stay text-only; schema collisions/unsupported compositions keep text handoff. Session priority is `sessionId` callback or `Tracer.setSessionId`, then agent-echoed conversation ID, then transport session ID; otherwise calls remain standalone. Use `{ injectConversationId: false }` to disable only conversation schema injection/handoff. To leave your tools and results unchanged:

```typescript
instrumentMcpServer(server, { injectAgentArguments: false });
```

Injection changes the advertised tool contract, including an optional `_judgment` property on compatible output schemas. During a mixed instrumented/uninstrumented rollout, strict clients holding an older output schema may reject structured results containing this property. Keep replica schemas consistent and refresh client tool discovery after rollout; gateways caching tool lists must refresh too.

Injection is independent of telemetry availability: installing instrumentation before `Tracer.init()`, or disabling export, does not disable schema changes or conversation handoff. Injected fields and descriptions add model-context overhead per tool when clients expose the listing to an agent. Set `injectAgentArguments: false` to disable automatic argument injection and handoff while retaining tracing, or `injectConversationId: false` to disable only conversation-ID injection and handoff.

Use `intentArgument`, `modelArgument`, and `conversationIdArgument` to choose names across all tools:

```typescript
instrumentMcpServer(server, {
  intentArgument: "intent",
  modelArgument: "judgment_llm_model",
  conversationIdArgument: "chat_id",
});
```

Explicit names opt existing fields into telemetry without changing their schemas or removing them from handler inputs. When absent from a compatible tool's schema, the SDK injects and strips the chosen name instead. Without explicit configuration, existing same-name fields are preserved but not interpreted as telemetry. Explicit fields can also be read with injection disabled; missing/non-string values are omitted. Existing conversation arguments supply application session IDs after callback/baggage resolution; injected conversation arguments use UUIDv7 echo handles. Names must be non-empty and distinct.

Low-level `Server` instances support the same injection and handoff as `McpServer`. High-level servers use their native registry; low-level calls use fresh caller-scoped, paginated `tools/list` discovery. To avoid that cost, provide a sync or async per-tool lookup:

```typescript
instrumentMcpServer(server, {
  resolveOriginalTool: (name) => originalTools.get(name),
});
```

Return the original wire descriptor (`inputSchema` and optional `outputSchema`), before Judgment injection, using the same schemas as your `tools/list` handler. Keep it scoped to the current caller if tools vary by authorization or request. Resolver results are not cached across calls. When configured, the resolver replaces discovery: returning `undefined`, throwing, or returning an unsupported schema leaves arguments untouched and omits generated handoff. Open/composed schemas are not injected, and customer-owned arguments are never stripped.

Error-message capture defaults off; outcome and error type are still recorded. Set `captureErrorMessages: true` to capture failure text. There is no automatic PII or argument-value scrubbing: enabled payload/error capture and agent-reported intent are sent as-is unless transformed by `redactPayload` or `redact`. Intent remains enabled by default; use `redact` to remove sensitive values or `injectAgentArguments: false` to disable agent-reported fields and session handoff.

Use `identify` or `setMcpCaller` to attach your end user, and `markMcpCallError` to record the original error before you turn it into a public tool error. The SDK can record the original exception type when the exception reaches its wrapper or is supplied through `markMcpCallError`. MCP frameworks may instead convert exceptions into `isError` results before the wrapper sees them; these generally use `error.type = "tool_error"`, since the original exception type is no longer available. Recognized refusals use `unknown_tool`, `tool_disabled`, or `invalid_input`; a structured public error code may also be used when error-message capture is enabled.

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
