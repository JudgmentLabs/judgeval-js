import { afterEach, describe, expect, test } from "bun:test";
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
} from "./agent-arguments";
import {
  instrumentMcpServer,
  markMcpCallStage,
  setMcpCaller,
  type InstrumentMcpServerOptions,
} from "./index";

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
  listTools(): Promise<{
    tools: readonly { name: string; inputSchema: { properties?: object } }[];
  }>;
}

interface Registrar {
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

function registerTools(server: object): void {
  const registrar = server as Registrar;
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
        markMcpCallStage("upstream");
        throw new Error("Upstream is down");
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
  if (options !== null) instrumentMcpServer(server, options);
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
    if (options !== null) instrumentMcpServer(server, options);
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
    stage: span?.attributes["judgment.mcp.failure.stage"],
    reason: span?.attributes["judgment.mcp.failure.reason"],
    status: span?.status.code,
  };
}

describe.each([
  ["@modelcontextprotocol/sdk 1.x", connectV1],
  ["@modelcontextprotocol/server 2.x", connectV2],
] as const)("instrumentMcpServer with %s", (_label, connect) => {
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

  test("records a tool that returns an error", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client.callTool({
      name: "greet",
      arguments: { name: "a", fail: true },
    });
    expect(failureOf(toolCallSpans(exporter)[0])).toEqual({
      errorType: "tool_error",
      stage: "handler",
      reason: "CONFLICT",
      status: 2,
    });
  });

  test("keeps the stage a handler marked", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client.callTool({
      name: "greet",
      arguments: { name: "a", thrown: true },
    });
    expect(failureOf(toolCallSpans(exporter)[0])).toEqual({
      errorType: "tool_error",
      stage: "upstream",
      reason: "unknown",
      status: 2,
    });
  });

  test("records invalid input as a validation failure", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client.callTool({ name: "greet", arguments: { name: 1 } });
    expect(failureOf(toolCallSpans(exporter)[0])).toEqual({
      errorType: "tool_error",
      stage: "validation",
      reason: "invalid_input",
      status: 2,
    });
  });

  test("records an unknown tool as a validation failure", async () => {
    const exporter = useExporter();
    const client = await connect({});
    await client
      .callTool({ name: "missing", arguments: {} })
      .catch(() => undefined);
    const failure = failureOf(toolCallSpans(exporter)[0]) as {
      stage: unknown;
      reason: unknown;
      status: unknown;
    };
    expect({
      stage: failure.stage,
      reason: failure.reason,
      status: failure.status,
    }).toEqual({ stage: "validation", reason: "unknown_tool", status: 2 });
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

  test("returns a new ID in content without touching structured output", async () => {
    useExporter();
    const client = await connect({});
    const result = (await client.callTool({
      name: "structured",
      arguments: {},
    })) as ToolResult;
    expect({
      blocks: textBlocks(result).length,
      structured: result.structuredContent,
    }).toEqual({ blocks: 2, structured: { ok: true } });
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
    instrumentMcpServer(server, {});
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
