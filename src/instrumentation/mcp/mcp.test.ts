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
  fromJsonSchema,
} from "@modelcontextprotocol/server";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { z } from "zod/v4";
import { BaseTracer } from "../../trace/BaseTracer";
import { JudgmentTracerProvider } from "../../trace/JudgmentTracerProvider";
import { NoOpSpanExporter } from "../../trace/exporters/NoOpSpanExporter";
import { NoOpSpanProcessor } from "../../trace/processors/NoOpSpanProcessor";
import type { JudgmentSpanExporter } from "../../trace/exporters/JudgmentSpanExporter";
import type { JudgmentSpanProcessor } from "../../trace/processors/JudgmentSpanProcessor";
import {
  declaredArguments,
  readReportedArguments,
  withAgentArguments,
  withConversationIdPrompt,
  withConversationOutputSchema,
} from "./agent-arguments";
import {
  instrumentMcpServer,
  markMcpCallError,
  setMcpCaller,
  type InstrumentMcpServerOptions,
} from "./index";
import { capturePayload } from "./payload";
import { trace } from "@opentelemetry/api";
import { Logger } from "../../utils/logger";

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

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

function useExporter() {
  const spans = new InMemorySpanExporter();
  const tracer = new TestTracer(
    new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(spans)],
    }),
  );
  const provider = JudgmentTracerProvider.getInstance();
  provider.register(tracer);
  provider.setActive(tracer);
  cleanups.push(() => provider.deregister(tracer));
  return spans;
}

type Result = {
  structuredContent?: { ok: boolean; _judgment?: { conversation_id: string } };
};

function registerTools(server: object) {
  (server as McpServerV1).registerTool(
    "greet",
    {
      inputSchema: z.strictObject({
        name: z.string(),
        fail: z.boolean().optional(),
      }),
      outputSchema: z.strictObject({ ok: z.boolean() }),
    },
    ({ fail }) => {
      setMcpCaller({ customerId: "customer-1" });
      JudgmentTracerProvider.getInstance()
        .getTracer("tool")
        .startSpan("database")
        .end();
      if (fail) {
        const message = `declined ${SECRET} for a@b.co`;
        markMcpCallError(new Error(message));
        return { isError: true, content: [{ type: "text", text: message }] };
      }
      return {
        content: [{ type: "text", text: "ok" }],
        structuredContent: { ok: true },
      };
    },
  );
}

async function connectV1(options: InstrumentMcpServerOptions) {
  const server = new McpServerV1({ name: "greeter", version: "1" });
  registerTools(server);
  instrumentMcpServer(server, options);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new ClientV1({ name: "test-client", version: "1" });
  await client.connect(clientSide);
  return client;
}

test.each([
  { sessionId: "transport-session" },
  { requestInfo: { headers: { "Mcp-Session-Id": "transport-session" } } },
  {
    sessionId: "",
    requestInfo: { headers: { "mcp-session-id": "transport-session" } },
  },
])(
  "transport sessions prevent unnecessary conversation minting: %j",
  async (context) => {
    const exporter = useExporter();
    const server = new McpServerV1({ name: "greeter", version: "1" });
    registerTools(server);
    let callbackSession: string | undefined;
    instrumentMcpServer(server, {
      sessionId: (info) => {
        callbackSession = info.sessionId;
        return "";
      },
    });
    // Exercise the dispatch boundary with the session supplied by a transport.
    const handlers = Reflect.get(server.server, "_requestHandlers");
    const result = await handlers.get("tools/call")(
      {
        method: "tools/call",
        params: { name: "greet", arguments: { name: "Alice" } },
      },
      context,
    );
    const call = exporter
      .getFinishedSpans()
      .find((span) => span.name === "tools/call greet");
    expect({
      callbackSession,
      output: result.structuredContent,
      session: call?.attributes["judgment.session_id"],
      source: call?.attributes["judgment.mcp.conversation_id_source"],
    }).toEqual({
      callbackSession: "transport-session",
      output: { ok: true },
      session: "transport-session",
      source: "transport",
    });
  },
);

test("schema discovery failures never turn a successful tool call into an error", async () => {
  const server = new McpServerV1({ name: "greeter", version: "1" });
  registerTools(server);
  server.registerTool(
    "unsupported",
    { inputSchema: z.object({ when: z.date() }) },
    () => ({ content: [] }),
  );
  instrumentMcpServer(server);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new ClientV1({ name: "test", version: "1" });
  await client.connect(clientSide);
  cleanups.push(() => client.close());
  const result = await client.callTool({
    name: "greet",
    arguments: { name: "Alice" },
  });
  expect(result.structuredContent).toEqual({ ok: true });
});

test("open JSON schemas preserve undeclared business arguments", async () => {
  let received: unknown;
  const handler = createMcpHandler(() => {
    const server = new McpServerV2({ name: "custom", version: "1" });
    server.registerTool(
      "lookup",
      {
        inputSchema: fromJsonSchema({
          type: "object",
          properties: { name: { type: "string" } },
        }),
      },
      (args) => {
        received = args;
        return { content: [] };
      },
    );
    instrumentMcpServer(server);
    return server;
  });
  const client = new ClientV2({ name: "test", version: "1" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
      fetch: (url, init) => handler.fetch(new Request(String(url), init)),
    }),
  );
  cleanups.push(() => client.close());
  await client.callTool({
    name: "lookup",
    arguments: { name: "Alice", context: "business-owned" },
  });
  expect(received).toEqual({ name: "Alice", context: "business-owned" });
});

async function connectV2(options: InstrumentMcpServerOptions) {
  const handler = createMcpHandler(() => {
    const server = new McpServerV2({ name: "greeter", version: "1" });
    registerTools(server);
    instrumentMcpServer(server, options);
    return server;
  });
  const client = new ClientV2({ name: "test-client", version: "1" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
      fetch: (url, init) => handler.fetch(new Request(String(url), init)),
    }),
  );
  return client;
}

describe.each([
  ["MCP 1.x", connectV1],
  ["MCP 2.x", connectV2],
] as const)("%s adapter", (_label, connect) => {
  test("captures redacted execution spans and hands off sessions without changing tool results", async () => {
    const exporter = useExporter();
    const client = await connect({
      captureInput: true,
      captureOutput: true,
      identify: () => ({ userId: "user-1" }),
      redactPayload: (value, field) =>
        field === "input"
          ? { ...(value as object), name: "[redacted]" }
          : value,
    });
    cleanups.push(() => client.close());
    await client.listTools();
    const first = (await client.callTool({
      name: "greet",
      arguments: {
        name: SECRET,
        context: "Greeting",
        llm_model: "model-1",
      },
    })) as Result;
    const session = first.structuredContent?._judgment?.conversation_id;
    await client.callTool({
      name: "greet",
      arguments: {
        name: SECRET,
        fail: true,
        conversation_id: session,
      },
    });
    const calls = exporter
      .getFinishedSpans()
      .filter((s) => s.attributes["mcp.method.name"] === "tools/call");
    expect({
      protocolSpans: exporter
        .getFinishedSpans()
        .filter(
          (s) =>
            s.attributes["mcp.method.name"] !== undefined &&
            s.attributes["mcp.method.name"] !== "tools/call",
        )
        .map((s) => s.name),
      session: typeof session,
      calls: calls.map((s) => ({
        session: s.attributes["judgment.session_id"],
        outcome: s.attributes["judgment.mcp.outcome"],
        input: JSON.parse(String(s.attributes["judgment.input"])),
        user: s.attributes["judgment.customer_user_id"],
        customer: s.attributes["judgment.customer_id"],
        errorText: s.attributes["judgment.mcp.error_message"],
        root: s.parentSpanContext === undefined,
        child: exporter
          .getFinishedSpans()
          .some(
            (child) =>
              child.name === "database" &&
              child.parentSpanContext?.spanId === s.spanContext().spanId,
          ),
      })),
      intent: calls[0]?.attributes["judgment.mcp.intent"],
      model: calls[0]?.attributes["judgment.llm.model"],
    }).toEqual({
      protocolSpans: [],
      session: "string",
      calls: ["success", "error"].map((outcome) => ({
        session,
        outcome,
        input:
          outcome === "success"
            ? { name: "[redacted]" }
            : { name: "[redacted]", fail: true },
        user: "user-1",
        customer: "customer-1",
        errorText: undefined,
        root: true,
        child: true,
      })),
      intent: "Greeting",
      model: "model-1",
    });
  });

  test("conversation injection can be disabled independently with explicit sessions and failed callbacks", async () => {
    const exporter = useExporter();
    const client = await connect({
      sessionId: () => "application-session",
      injectConversationId: false,
      captureInput: true,
      redactPayload: () => {
        throw new Error("redaction failed");
      },
      identify: () => {
        throw new Error("identity failed");
      },
    });
    cleanups.push(() => client.close());
    const tools = await client.listTools();
    const result = (await client.callTool({
      name: "greet",
      arguments: { name: SECRET, context: "Greeting" },
    })) as Result;
    const call = exporter
      .getFinishedSpans()
      .find((s) => s.attributes["mcp.method.name"] === "tools/call");
    const properties = tools.tools[0]?.inputSchema.properties as Record<
      string,
      unknown
    >;
    expect({
      fields: Object.keys(properties).sort(),
      output: result.structuredContent,
      session: call?.attributes["judgment.session_id"],
      intent: call?.attributes["judgment.mcp.intent"],
      input: call?.attributes["judgment.input"],
      omitted: call?.attributes["judgment.mcp.input_omitted"],
    }).toEqual({
      fields: ["context", "fail", "llm_model", "name"],
      output: { ok: true },
      session: "application-session",
      intent: "Greeting",
      input: undefined,
      omitted: "true",
    });
  });

  test("error text requires capture and applies customer redaction", async () => {
    const exporter = useExporter();
    const client = await connect({
      captureErrorMessages: true,
      redact: () => "[redacted]",
    });
    cleanups.push(() => client.close());
    await client.callTool({
      name: "greet",
      arguments: { name: SECRET, fail: true },
    });
    const call = exporter
      .getFinishedSpans()
      .find((s) => s.attributes["mcp.method.name"] === "tools/call");
    expect([
      call?.attributes["judgment.mcp.outcome"],
      call?.attributes["judgment.mcp.error_message"],
    ]).toEqual(["error", "[redacted]"]);
  });
});

test("only explicit incoming context parents calls; ambient server spans do not", async () => {
  const exporter = useExporter();
  const provider = JudgmentTracerProvider.getInstance();
  const client = await connectV1({ injectAgentArguments: false });
  cleanups.push(() => client.close());
  const ambient = provider.getTracer("server").startSpan("server");
  await provider.withContext(
    trace.setSpan(provider.getCurrentContext(), ambient),
    async () => {
      await client.callTool({ name: "greet", arguments: { name: "a" } });
      await client.callTool({
        name: "greet",
        arguments: { name: "a" },
        _meta: { traceparent: `00-${TRACE_ID}-b7ad6b7169203331-01` },
      });
    },
  );
  ambient.end();
  const calls = exporter
    .getFinishedSpans()
    .filter((s) => s.attributes["mcp.method.name"] === "tools/call");
  expect(
    calls.map((s) => [
      s.parentSpanContext?.spanId,
      s.spanContext().traceId === TRACE_ID,
      s.spanContext().traceId === ambient.spanContext().traceId,
    ]),
  ).toEqual([
    [undefined, false, false],
    ["b7ad6b7169203331", true, false],
  ]);
});

test("required and pattern-owned telemetry names retain their business schema", () => {
  const schema = {
    type: "object",
    properties: {} as Record<string, unknown>,
    required: ["context"],
    patternProperties: { "^llm_": { type: "number" } },
  };
  const tool = withAgentArguments({ name: "lookup", inputSchema: schema });
  expect({
    owned: declaredArguments(schema),
    added: Object.keys(tool.inputSchema.properties ?? {}),
  }).toEqual({
    owned: ["context", "llm_model"],
    added: ["conversation_id"],
  });
});

test("SDK diagnostics leave MCP stdout untouched", () => {
  const stdout = spyOn(process.stdout, "write").mockReturnValue(true);
  const stderr = spyOn(process.stderr, "write").mockReturnValue(true);
  try {
    Logger.warning("MCP delivery unavailable");
    expect({
      stdout: stdout.mock.calls.length,
      stderr: stderr.mock.calls.length,
    }).toEqual({ stdout: 0, stderr: 1 });
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
  }
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

describe("cancelled calls", () => {
  test("records a cancelled call as neither success nor failure", async () => {
    const exporter = useExporter();
    const provider = JudgmentTracerProvider.getInstance();
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
    instrumentMcpServer(server);
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
    await provider.forceFlush();
    const calls = exporter
      .getFinishedSpans()
      .filter((s) => s.attributes["mcp.method.name"] === "tools/call");
    expect(
      calls.map((s) => [
        s.attributes["judgment.mcp.outcome"],
        s.attributes["error.type"],
      ]),
    ).toEqual([["cancelled", undefined]]);
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
  test("annotates structured-only responses without requiring content", () => {
    const expected = {
      structuredContent: {
        ok: true,
        _judgment: {
          conversation_id: "id",
          note: "Pass this conversation_id on later tool calls in this conversation.",
        },
      },
      content: [
        {
          type: "text",
          text: JSON.stringify({
            conversation_id: "id",
            note: "Pass this conversation_id on later tool calls in this conversation.",
          }),
        },
      ],
    };
    expect(
      withConversationIdPrompt(
        { structuredContent: { ok: true } },
        "id",
        new Set(["tool"]),
        "tool",
      ),
    ).toEqual(expected);
  });
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

test("reported intent preserves text and remains length-bounded", () => {
  expect([
    readReportedArguments({ context: "Email a@b.co" }, new Set()).intent,
    readReportedArguments({ context: "a".repeat(1000) }, new Set()).intent,
  ]).toEqual(["Email a@b.co", "a".repeat(500)]);
});
