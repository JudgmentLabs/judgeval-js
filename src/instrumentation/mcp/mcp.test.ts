import { afterEach, describe, expect, spyOn, test } from "bun:test";
import {
  Client as ClientV2,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { Client as ClientV1 } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer as McpServerV1 } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  McpServer as McpServerV2,
  createMcpHandler,
} from "@modelcontextprotocol/server";
import { SpanKind } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import { z } from "zod/v4";
import { BaseTracer } from "../../trace/BaseTracer";
import { JudgmentTracerProvider } from "../../trace/JudgmentTracerProvider";
import { NoOpSpanExporter } from "../../trace/exporters/NoOpSpanExporter";
import { NoOpSpanProcessor } from "../../trace/processors/NoOpSpanProcessor";
import type { JudgmentSpanExporter } from "../../trace/exporters/JudgmentSpanExporter";
import type { JudgmentSpanProcessor } from "../../trace/processors/JudgmentSpanProcessor";
import {
  mintConversationId,
  sanitizeIntent,
  withAgentArguments,
  withConversationIdPrompt,
  withConversationOutputSchema,
} from "./agent-arguments";
import {
  instrumentMcpServer,
  captureMcpCall,
  markMcpCallError,
  setMcpCaller,
  type InstrumentMcpServerOptions,
} from "./index";
import { capturePayload, McpCallExporter, type McpCall } from "./exporter";

const SECRET = "super-secret-value";
const TRACE_ID = "0af7651916cd43dd8448eb211c80319c";

class TestTracer extends BaseTracer {
  constructor(provider: BasicTracerProvider) {
    super(
      "project",
      "project-id",
      "key",
      "org",
      "https://example.com",
      null,
      String,
      provider,
      null,
      false,
    );
  }
  getSpanProcessor(): JudgmentSpanProcessor {
    return new NoOpSpanProcessor() as unknown as JudgmentSpanProcessor;
  }
  getSpanExporter(): JudgmentSpanExporter {
    return new NoOpSpanExporter();
  }
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function useExporter(): InMemorySpanExporter {
  const exporter = new InMemorySpanExporter();
  const tracer = new TestTracer(
    new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    }),
  );
  const proxy = JudgmentTracerProvider.getInstance();
  proxy.register(tracer);
  proxy.setActive(tracer);
  cleanups.push(() => proxy.deregister(tracer));
  return exporter;
}

interface ToolResult {
  readonly isError?: boolean;
  readonly content?: unknown;
  readonly structuredContent?: unknown;
}

interface TestClient {
  callTool(request: {
    name: string;
    arguments?: Record<string, unknown>;
    _meta?: Record<string, unknown>;
  }): Promise<unknown>;
  readResource(request: { uri: string }): Promise<unknown>;
  listTools(): Promise<{
    tools: readonly { name: string; inputSchema: { properties?: object } }[];
  }>;
}

interface Registrar {
  registerResource(
    name: string,
    uri: string,
    config: object,
    handler: (uri: URL) => Promise<unknown>,
  ): unknown;
  registerTool(
    name: string,
    config: {
      description: string;
      inputSchema: unknown;
      outputSchema?: unknown;
    },
    handler: (input: Record<string, unknown>) => Promise<unknown>,
  ): unknown;
}

const seenInputs: Record<string, unknown>[] = [];
const SHARED_SCHEMA = z.strictObject({});

function registerTools(server: object): void {
  const registrar = server as Registrar;
  registrar.registerResource(
    "report",
    "report://latest?token=secret-token",
    {},
    (uri) => Promise.resolve({ contents: [{ uri: uri.href, text: "ok" }] }),
  );
  for (const name of ["shared_a", "shared_b"]) {
    registrar.registerTool(
      name,
      { description: "Shares a schema", inputSchema: SHARED_SCHEMA },
      () => Promise.resolve({ content: [{ type: "text", text: "ok" }] }),
    );
  }
  registrar.registerTool(
    "greet",
    {
      description: "Greets someone",
      inputSchema: z.strictObject({
        name: z.string(),
        fail: z.boolean().optional(),
        thrown: z.boolean().optional(),
      }),
    },
    (input) => {
      seenInputs.push(input);
      setMcpCaller({ customerId: "customer-1" });
      if (input["thrown"] === true) {
        const error = new Error("Upstream is down");
        error.name = "UpstreamError";
        markMcpCallError(error);
        throw error;
      }
      if (input["fail"] === true) {
        return Promise.resolve({
          isError: true,
          content: [
            { type: "text", text: JSON.stringify({ error: "CONFLICT" }) },
          ],
        });
      }
      return Promise.resolve({ content: [{ type: "text", text: "hello" }] });
    },
  );
  registrar.registerTool(
    "wordy_error",
    { description: "Fails with free text", inputSchema: z.strictObject({}) },
    () =>
      Promise.resolve({
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `no access: ${SECRET}` }),
          },
        ],
      }),
  );
  registrar.registerTool(
    "token_error",
    { description: "Fails with a token", inputSchema: z.strictObject({}) },
    () =>
      Promise.resolve({
        isError: true,
        content: [
          { type: "text", text: JSON.stringify({ error: "sk-abc123def456" }) },
        ],
      }),
  );
  registrar.registerTool(
    "open",
    { description: "Accepts anything", inputSchema: z.looseObject({}) },
    (input) => {
      seenInputs.push(input);
      return Promise.resolve({ content: [{ type: "text", text: "ok" }] });
    },
  );
  registrar.registerTool(
    "structured",
    {
      description: "Returns structured output",
      inputSchema: z.strictObject({ context: z.string().optional() }),
      outputSchema: z.strictObject({ ok: z.boolean() }),
    },
    (input) => {
      seenInputs.push(input);
      return Promise.resolve({
        content: [{ type: "text", text: '{"ok":true}' }],
        structuredContent: { ok: true },
      });
    },
  );
}

async function connectV1(
  options: InstrumentMcpServerOptions | null,
): Promise<TestClient> {
  const server = new McpServerV1({ name: "greeter", version: "1.0.0" });
  registerTools(server);
  if (options !== null)
    instrumentMcpServer(server, { recordSpans: true, ...options });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new ClientV1({ name: "test-client", version: "2.0.0" });
  await client.connect(clientSide);
  return client as unknown as TestClient;
}

async function connectV2(
  options: InstrumentMcpServerOptions | null,
): Promise<TestClient> {
  const handler = createMcpHandler(() => {
    const server = new McpServerV2({ name: "greeter", version: "1.0.0" });
    registerTools(server);
    if (options !== null)
      instrumentMcpServer(server, { recordSpans: true, ...options });
    return server;
  });
  const client = new ClientV2({ name: "test-client", version: "2.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
      fetch: async (url, init) =>
        await handler.fetch(new Request(String(url), init)),
    }),
  );
  return client as unknown as TestClient;
}

function toolCallSpans(exporter: InMemorySpanExporter): ReadableSpan[] {
  return exporter
    .getFinishedSpans()
    .filter((span) => span.attributes["mcp.method.name"] === "tools/call");
}

function textBlocks(result: unknown): string[] {
  const content = (result as ToolResult).content as { text: string }[];
  return content.map((block) => block.text);
}

function failureOf(span: ReadableSpan | undefined): unknown {
  return {
    errorType: span?.attributes["error.type"],
    status: span?.status.code,
  };
}

describe.each([
  ["@modelcontextprotocol/sdk 1.x", connectV1],
  ["@modelcontextprotocol/server 2.x", connectV2],
] as const)("instrumentMcpServer with %s", (_label, connect) => {
  test("uses explicit sessions and leaves payload capture off by default", async () => {
    useExporter();
    const provider = JudgmentTracerProvider.getInstance();
    provider.getActiveTracer()!._enableMonitoring = true;
    const events: McpCall[] = [];
    const sending = spyOn(globalThis, "fetch").mockImplementation(
      Object.assign(
        (_url: string | URL | Request, init?: RequestInit) => {
          events.push(
            ...(JSON.parse(String(init?.body)) as { calls: McpCall[] }).calls,
          );
          return Promise.resolve(new Response(null, { status: 200 }));
        },
        { preconnect: globalThis.fetch.preconnect },
      ),
    );
    try {
      const client = await connect({
        recordSpans: false,
        sessionId: () => "application-session",
      });
      const result = await client.callTool({
        name: "greet",
        arguments: { name: SECRET },
      });
      captureMcpCall({
        timestamp: new Date().toISOString(),
        duration_ms: 1,
        outcome: "success",
        server_name: "custom",
        tool_name: "manual",
        argument_keys: [],
        metadata: {},
        input: null,
      });
      await provider.forceFlush();
      expect({
        events: events.map((call) => ({
          tool: call.tool_name,
          session: call.session_id,
          input: call.input,
          output: call.output,
        })),
        prompts: textBlocks(result).filter((text) =>
          text.includes("conversation_id"),
        ),
      }).toEqual({
        events: [
          {
            tool: "greet",
            session: "application-session",
            input: undefined,
            output: undefined,
          },
          {
            tool: "manual",
            session: undefined,
            input: null,
            output: undefined,
          },
        ],
        prompts: [],
      });
    } finally {
      await provider.shutdown();
      sending.mockRestore();
    }
  });

  test("exports native calls without OTel spans and preserves retry identity", async () => {
    const spans = useExporter();
    const provider = JudgmentTracerProvider.getInstance();
    const tracer = provider.getActiveTracer()!;
    tracer._enableMonitoring = true;
    tracer.environment = "test";
    const bodies: string[] = [];
    const sending = spyOn(globalThis, "fetch").mockImplementation(
      Object.assign(
        (_url: string | URL | Request, init?: RequestInit) => {
          bodies.push(String(init?.body));
          return Promise.resolve(
            new Response(null, {
              status: bodies.length === 1 ? 503 : 200,
            }),
          );
        },
        { preconnect: globalThis.fetch.preconnect },
      ),
    );
    try {
      const client = await connect({
        recordSpans: false,
        captureInput: true,
        captureOutput: true,
        identify: () => ({ userId: "user-1" }),
        redactPayload: (value, field) =>
          field === "input"
            ? { ...(value as object), name: "[redacted]" }
            : value,
      });
      await client.callTool({ name: "greet", arguments: { name: SECRET } });
      await client.callTool({
        name: "greet",
        arguments: { name: "other", fail: true },
      });
      await provider.forceFlush();
      const calls = (JSON.parse(bodies[0]!) as { calls: McpCall[] }).calls;
      expect({
        retriesIdentical: bodies[0] === bodies[1],
        distinctIds: calls[0]?.call_id !== calls[1]?.call_id,
        events: calls.map((call) => ({
          tool: call.tool_name,
          outcome: call.outcome,
          input: call.input,
          keys: call.argument_keys,
          user: call.user_id,
          environment: call.environment_name,
          session: typeof call.session_id,
          trace: call.trace_id,
          output: call.output !== undefined,
          duration: call.duration_ms >= 0,
        })),
        spans: spans.getFinishedSpans().length,
      }).toEqual({
        retriesIdentical: true,
        distinctIds: true,
        events: [
          {
            tool: "greet",
            outcome: "success",
            input: { name: "[redacted]" },
            keys: ["name"],
            user: "user-1",
            environment: "test",
            session: "string",
            trace: undefined,
            output: true,
            duration: true,
          },
          {
            tool: "greet",
            outcome: "error",
            input: { name: "[redacted]", fail: true },
            keys: ["name", "fail"],
            user: "user-1",
            environment: "test",
            session: "string",
            trace: undefined,
            output: true,
            duration: true,
          },
        ],
        spans: 0,
      });
    } finally {
      await provider.shutdown();
      sending.mockRestore();
    }
  });

  test("records a successful call as a standard server span", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client.callTool({ name: "greet", arguments: { name: SECRET } });
    const span = toolCallSpans(exporter)[0];
    expect({
      name: span?.name,
      kind: span?.kind,
      method: span?.attributes["mcp.method.name"],
      tool: span?.attributes["gen_ai.tool.name"],
      operation: span?.attributes["gen_ai.operation.name"],
      server: span?.attributes["judgment.mcp.server.name"],
      errorType: span?.attributes["error.type"],
      keys: span?.attributes["judgment.mcp.argument_keys"],
    }).toEqual({
      name: "tools/call greet",
      kind: SpanKind.SERVER,
      method: "tools/call",
      tool: "greet",
      operation: "execute_tool",
      server: "greeter",
      errorType: undefined,
      keys: "name",
    });
  });

  test("never records argument values", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client.callTool({ name: "greet", arguments: { name: SECRET } });
    await client.callTool({
      name: "greet",
      arguments: { name: SECRET, extra: SECRET },
    });
    const recorded = JSON.stringify(
      toolCallSpans(exporter).map((span) => span.attributes),
    );
    expect(recorded.includes(SECRET)).toEqual(false);
  });

  test("types a returned structured error by its code", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client.callTool({
      name: "greet",
      arguments: { name: "a", fail: true },
    });
    expect(failureOf(toolCallSpans(exporter)[0])).toEqual({
      errorType: "CONFLICT",
      status: 2,
    });
  });

  test("types a failure by the class of the error the handler recorded", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client.callTool({
      name: "greet",
      arguments: { name: "a", thrown: true },
    });
    expect(failureOf(toolCallSpans(exporter)[0])).toEqual({
      errorType: "UpstreamError",
      status: 2,
    });
  });

  test("types invalid input as invalid_input", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client.callTool({ name: "greet", arguments: { name: 1 } });
    expect(failureOf(toolCallSpans(exporter)[0])).toEqual({
      errorType: "invalid_input",
      status: 2,
    });
  });

  test("types an unknown tool as unknown_tool", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client
      .callTool({ name: "missing", arguments: {} })
      .catch(() => undefined);
    expect(failureOf(toolCallSpans(exporter)[0])).toEqual({
      errorType: "unknown_tool",
      status: 2,
    });
  });

  test("joins the caller's trace when _meta carries one", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client.callTool({
      name: "greet",
      arguments: { name: "a" },
      _meta: { traceparent: `00-${TRACE_ID}-b7ad6b7169203331-01` },
    });
    const span = toolCallSpans(exporter)[0];
    expect({
      traceId: span?.spanContext().traceId,
      parentSpanId: span?.parentSpanContext?.spanId,
    }).toEqual({ traceId: TRACE_ID, parentSpanId: "b7ad6b7169203331" });
  });

  test("starts its own trace when the caller sends none", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client.callTool({ name: "greet", arguments: { name: "a" } });
    expect(toolCallSpans(exporter)[0]?.parentSpanContext).toEqual(undefined);
  });

  test("adds optional arguments to listed tools by default", async () => {
    useExporter();
    const client = await connect({});
    const { tools } = await client.listTools();
    const greet = tools.find((tool) => tool.name === "greet");
    expect(Object.keys(greet?.inputSchema.properties ?? {}).sort()).toEqual([
      "context",
      "conversation_id",
      "fail",
      "llm_model",
      "name",
      "thrown",
    ]);
  });

  test("records reported values and hides them from the handler", async () => {
    const exporter = useExporter();
    seenInputs.length = 0;
    const client = await connect({});
    await client.callTool({
      name: "greet",
      arguments: {
        name: "a",
        context: "Contacting ana@example.com about billing",
        llm_model: "model-1",
      },
    });
    const span = toolCallSpans(exporter)[0];
    expect({
      seen: seenInputs,
      intent: span?.attributes["judgment.mcp.intent"],
      model: span?.attributes["judgment.mcp.model"],
    }).toEqual({
      seen: [{ name: "a" }],
      intent: "Contacting [email] about billing",
      model: "model-1",
    });
  });

  test("leaves a tool's own argument of the same name alone", async () => {
    const exporter = useExporter();
    seenInputs.length = 0;
    const client = await connect({});
    await client.callTool({
      name: "structured",
      arguments: { context: "the tool's own value" },
    });
    expect({
      seen: seenInputs,
      intent: toolCallSpans(exporter)[0]?.attributes["judgment.mcp.intent"],
    }).toEqual({
      seen: [{ context: "the tool's own value" }],
      intent: undefined,
    });
  });

  test("ignores an invented conversation ID and mints its own", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client.callTool({
      name: "greet",
      arguments: { name: "a", conversation_id: "made-up-by-agent" },
    });
    const attributes = toolCallSpans(exporter)[0]?.attributes;
    expect({
      source: attributes?.["judgment.mcp.conversation_id_source"],
      invented:
        attributes?.["judgment.mcp.conversation_id"] === "made-up-by-agent",
    }).toEqual({ source: "minted", invented: false });
  });

  test("keeps an echoed conversation ID", async () => {
    const exporter = useExporter();
    const client = await connect({});
    const id = mintConversationId();
    const result = await client.callTool({
      name: "greet",
      arguments: { name: "a", conversation_id: id },
    });
    const attributes = toolCallSpans(exporter)[0]?.attributes;
    expect({
      id: attributes?.["judgment.mcp.conversation_id"],
      source: attributes?.["judgment.mcp.conversation_id_source"],
      blocks: textBlocks(result).length,
    }).toEqual({ id, source: "echoed", blocks: 1 });
  });

  test("hands off the same ID to structured-only clients with a strict output schema", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client.listTools();
    const result = (await client.callTool({
      name: "structured",
      arguments: {},
    })) as ToolResult;
    const blocks = textBlocks(result);
    const prompt = JSON.parse(blocks[blocks.length - 1]!);
    const structured = result.structuredContent as {
      _judgment: { conversation_id: string };
    };
    const echoed = (await client.callTool({
      name: "structured",
      arguments: { conversation_id: structured._judgment.conversation_id },
    })) as ToolResult;
    expect({
      blocks: textBlocks(result).length,
      structured: result.structuredContent,
      echoed: echoed.structuredContent,
      ids: toolCallSpans(exporter).map(
        (span) => span.attributes["judgment.mcp.conversation_id"],
      ),
    }).toEqual({
      blocks: 2,
      structured: { ok: true, _judgment: prompt },
      echoed: { ok: true },
      ids: [prompt.conversation_id, prompt.conversation_id],
    });
  });

  test("leaves tools and results unchanged when injection is off", async () => {
    useExporter();
    const plain = await connect(null);
    const traced = await connect({ injectAgentArguments: false });
    const call = { name: "greet", arguments: { name: "a" } };
    expect({
      tools: (await traced.listTools()).tools,
      result: await traced.callTool(call),
    }).toEqual({
      tools: (await plain.listTools()).tools,
      result: await plain.callTool(call),
    });
  });

  test("records who the call was for", async () => {
    const exporter = useExporter();
    const client = await connect({ identify: () => ({ userId: "user-1" }) });
    await client.callTool({ name: "greet", arguments: { name: "a" } });
    const attributes = toolCallSpans(exporter)[0]?.attributes;
    expect({
      user: attributes?.["enduser.id"],
      customer: attributes?.["judgment.customer_id"],
    }).toEqual({ user: "user-1", customer: "customer-1" });
  });

  test("a failing identify callback never affects the call", async () => {
    useExporter();
    const client = await connect({
      identify: () => {
        throw new Error("identify failed");
      },
    });
    const result = await client.callTool({
      name: "greet",
      arguments: { name: "a", conversation_id: mintConversationId() },
    });
    expect(textBlocks(result)).toEqual(["hello"]);
  });

  test("a failing redact sends no text and never affects the call", async () => {
    const exporter = useExporter();
    const client = await connect({
      redact: () => {
        throw new Error("redact failed");
      },
    });
    const result = await client.callTool({
      name: "greet",
      arguments: {
        name: "a",
        context: "why",
        conversation_id: mintConversationId(),
      },
    });
    await client.callTool({
      name: "greet",
      arguments: { name: "a", fail: true },
    });
    const [success, failure] = toolCallSpans(exporter);
    expect({
      blocks: textBlocks(result),
      intent: success?.attributes["judgment.mcp.intent"],
      failureEnded: failure?.status.code,
      failureMessage: failure?.status.message,
    }).toEqual({
      blocks: ["hello"],
      intent: undefined,
      failureEnded: 2,
      failureMessage: undefined,
    });
  });

  test("never records free text a tool returned as a structured error", async () => {
    const exporter = useExporter();
    const client = await connect({ captureErrorMessages: false });
    await client.callTool({ name: "wordy_error", arguments: {} });
    expect(toolCallSpans(exporter)[0]?.attributes["error.type"]).toEqual(
      "tool_error",
    );
  });

  test("never records a token-shaped error code", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client.callTool({ name: "token_error", arguments: {} });
    expect(toolCallSpans(exporter)[0]?.attributes["error.type"]).toEqual(
      "tool_error",
    );
  });

  test("drops credentials from a resource URI", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client.readResource({ uri: "report://latest?token=secret-token" });
    const span = exporter
      .getFinishedSpans()
      .find((candidate) => candidate.name === "resources/read");
    expect(span?.attributes["mcp.resource.uri"]).toEqual("report://latest");
  });

  test("gives tools sharing one schema their own contract hash", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client.callTool({ name: "shared_a", arguments: {} });
    await client.callTool({ name: "shared_b", arguments: {} });
    const hashes = toolCallSpans(exporter).map(
      (span) => span.attributes["judgment.mcp.contract_hash"],
    );
    expect(new Set(hashes).size).toEqual(2);
  });

  test("records a tool's own argument named like an injected one", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client.callTool({
      name: "structured",
      arguments: { context: "theirs", llm_model: "model-1" },
    });
    expect(
      toolCallSpans(exporter)[0]?.attributes["judgment.mcp.argument_keys"],
    ).toEqual("context");
  });

  test("records every argument name when injection is off", async () => {
    const exporter = useExporter();
    const client = await connect({ injectAgentArguments: false });
    await client.callTool({ name: "open", arguments: { context: "theirs" } });
    expect(
      toolCallSpans(exporter)[0]?.attributes["judgment.mcp.argument_keys"],
    ).toEqual("context");
  });

  test("leaves a tool that accepts unknown keys alone", async () => {
    useExporter();
    seenInputs.length = 0;
    const client = await connect({});
    const { tools } = await client.listTools();
    await client.callTool({ name: "open", arguments: { context: "theirs" } });
    expect({
      seen: seenInputs,
      listed: Object.keys(
        tools.find((tool) => tool.name === "open")?.inputSchema.properties ??
          {},
      ),
    }).toEqual({ seen: [{ context: "theirs" }], listed: [] });
  });

  test("redacts failure messages and honors turning them off", async () => {
    const exporter = useExporter();
    const redacting = await connect({ redact: () => "[redacted]" });
    const silent = await connect({ captureErrorMessages: false });
    const call = { name: "greet", arguments: { name: "a", fail: true } };
    await redacting.callTool(call);
    await silent.callTool(call);
    expect(toolCallSpans(exporter).map((span) => span.status.message)).toEqual([
      "[redacted]",
      undefined,
    ]);
  });
});

test("payload capture detaches values and omits unsafe data without changing the source", () => {
  const original = { token: SECRET };
  const captured = capturePayload(original, "input", (value) => {
    (value as { token: string }).token = "safe";
    return value;
  });
  expect({
    original,
    captured,
    failure: capturePayload(original, "output", () => {
      throw new Error(SECRET);
    }),
    oversized: capturePayload("x".repeat(128 * 1024), "output"),
    null: capturePayload(null, "output"),
  }).toEqual({
    original: { token: SECRET },
    captured: { token: "safe" },
    failure: undefined,
    oversized: undefined,
    null: null,
  });
});

test("native delivery bounds batches and queue and does not retry permanent errors", async () => {
  const sizes: number[] = [];
  const sending = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      (_url: string | URL | Request, init?: RequestInit) => {
        sizes.push(
          (JSON.parse(String(init?.body)) as { calls: McpCall[] }).calls.length,
        );
        return Promise.resolve(
          new Response(null, { status: sizes.length === 1 ? 400 : 200 }),
        );
      },
      { preconnect: globalThis.fetch.preconnect },
    ),
  );
  const exporter = new McpCallExporter({
    apiUrl: "http://localhost",
    apiKey: "key",
    organizationId: "org",
    projectId: "project",
  });
  try {
    for (let index = 0; index < 1001; index++)
      exporter.enqueue({
        call_id: String(index),
        timestamp: "2026-11-10T00:00:00Z",
        duration_ms: 0,
        outcome: "success",
        server_name: "server",
        tool_name: "tool",
        argument_keys: [],
        metadata: {},
      });
    await exporter.shutdown();
    expect(sizes).toEqual(Array(10).fill(100));
  } finally {
    sending.mockRestore();
  }
});

describe("tool updates", () => {
  test("re-reads a tool's schema after it changes", async () => {
    useExporter();
    seenInputs.length = 0;
    const server = new McpServerV1({ name: "greeter", version: "1.0.0" });
    const tool = server.registerTool(
      "changing",
      { description: "Changes", inputSchema: z.strictObject({}) },
      (input: Record<string, unknown>) => {
        seenInputs.push(input);
        return { content: [{ type: "text" as const, text: "ok" }] };
      },
    );
    instrumentMcpServer(server, { recordSpans: true });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new ClientV1({ name: "test-client", version: "2.0.0" });
    await client.connect(clientSide);
    await client.callTool({ name: "changing", arguments: {} });
    tool.update({ paramsSchema: { context: z.string() } });
    await client.callTool({
      name: "changing",
      arguments: { context: "theirs" },
    });
    expect(seenInputs[seenInputs.length - 1]).toEqual({ context: "theirs" });
  });
});

describe("cancelled calls", () => {
  test("records a cancelled call as neither success nor failure", async () => {
    const exporter = useExporter();
    const server = new McpServerV1({ name: "greeter", version: "1.0.0" });
    let release = (): void => undefined;
    let started = (): void => undefined;
    const running = new Promise<void>((resolve) => {
      started = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.registerTool(
      "slow",
      { description: "Waits", inputSchema: z.strictObject({}) },
      async () => {
        started();
        await held;
        return { content: [{ type: "text" as const, text: "done" }] };
      },
    );
    instrumentMcpServer(server, { recordSpans: true });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new ClientV1({ name: "test-client", version: "2.0.0" });
    await client.connect(clientSide);
    const controller = new AbortController();
    const call = client
      .callTool({ name: "slow", arguments: {} }, undefined, {
        signal: controller.signal,
      })
      .catch(() => undefined);
    await running;
    controller.abort();
    await call;
    await new Promise((resolve) => setTimeout(resolve, 10));
    release();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const attributes = toolCallSpans(exporter)[0]?.attributes;
    expect({
      cancelled: attributes?.["judgment.mcp.cancelled"],
      errorType: attributes?.["error.type"],
    }).toEqual({ cancelled: "true", errorType: undefined });
  });
});

describe("withAgentArguments", () => {
  test.each(["oneOf", "anyOf", "allOf", "$ref"])(
    "leaves a schema using %s unchanged",
    (keyword) => {
      const tool = {
        name: "t",
        inputSchema: { type: "object", [keyword]: [] },
      };
      expect(withAgentArguments(tool)).toEqual(tool);
    },
  );
});

describe("structured conversation handoff", () => {
  test.each([
    { properties: { _judgment: { type: "string" } } },
    { oneOf: [] },
    { maxProperties: 1 },
    { const: { ok: true } },
    { enum: [{ ok: true }] },
  ])("leaves incompatible output schemas alone: %j", (constraints) => {
    expect(
      withConversationOutputSchema({ type: "object", ...constraints }),
    ).toBeUndefined();
  });

  test.each([undefined, { _judgment: "developer-owned" }])(
    "never replaces text-only output or developer fields: %j",
    (structuredContent) => {
      const result = {
        content: [{ type: "text", text: "original" }],
        structuredContent,
        isError: true,
      };
      const updated = withConversationIdPrompt(
        result,
        "id",
        new Set(["tool"]),
        "tool",
      );
      expect({ ...updated, content: updated.content.slice(0, -1) }).toEqual(
        result,
      );
    },
  );
});

describe("sanitizeIntent", () => {
  test("removes well-defined identifiers and leaves ordinary text", () => {
    expect(
      sanitizeIntent(
        "Email a@b.co, call +1 415 555 0100, card 4242 4242 4242 4242, ssn 123-45-6789, ip 10.1.2.3, about 2 invoices",
      ),
    ).toEqual(
      "Email [email], call [phone], card [card], ssn [ssn], ip [ip], about 2 invoices",
    );
  });
});
