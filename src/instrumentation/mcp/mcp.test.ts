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
  captureMcpCall,
  markMcpCallError,
  setMcpCaller,
  type InstrumentMcpServerOptions,
} from "./index";
import { capturePayload, McpCallExporter, type McpCall } from "./exporter";
import { Logger } from "../../utils/logger";

const SECRET = "super-secret-value";
const TRACE_ID = "0af7651916cd43dd8448eb211c80319c";
const completedCall: McpCall = {
  call_id: "stable",
  timestamp: "2026-11-10T00:00:00Z",
  duration_ms: 1,
  outcome: "success",
  server_name: "custom",
  tool_name: "lookup",
  argument_keys: [],
  metadata: {},
};

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

function requestBody(url: string | URL | Request, init?: RequestInit) {
  return url instanceof Request ? url.text() : String(init?.body);
}

function captureNativeRequests(statuses = [200]) {
  const provider = JudgmentTracerProvider.getInstance();
  provider.getActiveTracer()!._enableMonitoring = true;
  const bodies: string[] = [];
  const sending = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (url: string | URL | Request, init?: RequestInit) => {
        bodies.push(await requestBody(url, init));
        return new Response(null, { status: statuses.shift() ?? 200 });
      },
      { preconnect: globalThis.fetch.preconnect },
    ),
  );
  cleanups.push(() => {
    sending.mockRestore();
  });
  cleanups.push(() => provider.shutdown());
  return { provider, bodies };
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
  test("uses explicit sessions with injection disabled and payload capture off", async () => {
    useExporter();
    const { provider, bodies } = captureNativeRequests();
    const client = await connect({
      sessionId: () => "application-session",
      injectAgentArguments: false,
    });
    const result = (await client.callTool({
      name: "greet",
      arguments: { name: SECRET },
    })) as Result;
    captureMcpCall({ ...completedCall, input: null });
    await provider.forceFlush();
    const calls = (JSON.parse(bodies[0]!) as { calls: McpCall[] }).calls;
    expect({
      result: result.structuredContent,
      calls: calls.map((call) => [call.session_id, call.input, call.output]),
    }).toEqual({
      result: { ok: true },
      calls: [
        ["application-session", undefined, undefined],
        [undefined, null, undefined],
      ],
    });
  });

  test("captures redacted calls and hands off a server-generated session in structured output", async () => {
    const spans = useExporter();
    const { provider, bodies } = captureNativeRequests([503, 200]);
    const client = await connect({
      captureInput: true,
      captureOutput: true,
      identify: () => ({ userId: "user-1" }),
      redactPayload: (value, field) =>
        field === "input"
          ? { ...(value as object), name: "[redacted]" }
          : value,
    });
    const first = (await client.callTool({
      name: "greet",
      arguments: {
        name: SECRET,
        context: "Contacting a@b.co",
        llm_model: "model-1",
        conversation_id: "invented",
      },
    })) as Result;
    const session = first.structuredContent?._judgment?.conversation_id;
    await client.callTool({
      name: "greet",
      arguments: { name: SECRET, fail: true, conversation_id: session },
    });
    await provider.forceFlush();
    const calls = (JSON.parse(bodies[0]!) as { calls: McpCall[] }).calls;
    expect({
      retryIdentical: bodies[0] === bodies[1],
      distinctIds: calls[0]!.call_id !== calls[1]!.call_id,
      validSession:
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          session ?? "",
        ),
      calls: calls.map((call) => ({
        session: call.session_id,
        outcome: call.outcome,
        input: call.input,
        keys: call.argument_keys,
        user: call.user_id,
        customer: call.metadata["customer_id"],
        output: call.output !== undefined,
        duration: call.duration_ms >= 0,
      })),
      intent: calls[0]!.intent,
      model: calls[0]!.model,
      spans: spans.getFinishedSpans().length,
    }).toEqual({
      retryIdentical: true,
      distinctIds: true,
      validSession: true,
      calls: ([false, true] as const).map((fail) => ({
        session,
        outcome: fail ? "error" : "success",
        input: fail
          ? { name: "[redacted]", fail: true }
          : { name: "[redacted]" },
        keys: fail ? ["name", "fail"] : ["name"],
        user: "user-1",
        customer: "customer-1",
        output: true,
        duration: true,
      })),
      intent: "Contacting a@b.co",
      model: "model-1",
      spans: 0,
    });
  });

  test.each([
    [{}, undefined],
    [{ captureErrorMessages: true }, `declined ${SECRET} for a@b.co`],
    [{ captureErrorMessages: true, redact: () => "[redacted]" }, "[redacted]"],
    [
      { captureErrorMessages: true, redact: () => JSON.parse("null") },
      undefined,
    ],
    [
      { captureErrorMessages: true, redact: () => Reflect.get({}, "missing") },
      undefined,
    ],
    [
      {
        captureErrorMessages: true,
        redact: () => {
          throw new Error("redaction failed");
        },
      },
      undefined,
    ],
  ] satisfies [InstrumentMcpServerOptions, string | undefined][])(
    "error text follows explicit capture and redaction options: %j",
    async (options, expected) => {
      const spans = useExporter();
      const { provider, bodies } = captureNativeRequests();
      const client = await connect({ ...options, recordSpans: true });
      await client.callTool({
        name: "greet",
        arguments: { name: SECRET, fail: true },
      });
      await provider.forceFlush();
      const call = (JSON.parse(bodies[0]!) as { calls: McpCall[] }).calls[0]!;
      const span = spans
        .getFinishedSpans()
        .find((span) => span.name === "tools/call greet")!;
      expect([
        call.outcome,
        call.error_type,
        call.error_message,
        span.status.message,
      ]).toEqual(["error", "tool_error", expected, expected]);
    },
  );

  test("callback failures do not change business results", async () => {
    useExporter();
    const { provider, bodies } = captureNativeRequests();
    const fail = () => {
      throw new Error("unavailable");
    };
    const client = await connect({
      identify: fail,
      redact: fail,
      sessionId: fail,
    });
    await client.callTool({
      name: "greet",
      arguments: { name: "a", context: "private" },
    });
    await provider.forceFlush();
    const call = (JSON.parse(bodies[0]!) as { calls: McpCall[] }).calls[0]!;
    expect([call.outcome, call.user_id, call.intent]).toEqual([
      "success",
      undefined,
      undefined,
    ]);
  });
});

test("optional OTel spans link native calls to remote context", async () => {
  const spans = useExporter();
  const { provider, bodies } = captureNativeRequests();
  const client = await connectV1({ recordSpans: true });
  await client.callTool({
    name: "greet",
    arguments: { name: "a" },
    _meta: { traceparent: `00-${TRACE_ID}-b7ad6b7169203331-01` },
  });
  await provider.forceFlush();
  const span = spans
    .getFinishedSpans()
    .find((span) => span.name === "tools/call greet")!;
  const call = (JSON.parse(bodies[0]!) as { calls: McpCall[] }).calls[0]!;
  expect([call.trace_id, call.span_id, span.parentSpanContext?.spanId]).toEqual(
    [TRACE_ID, span.spanContext().spanId, "b7ad6b7169203331"],
  );
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

test.each(["deadline", "cooldown"])(
  "native delivery retains calls across %s",
  async (mode) => {
    let monotonic = 0;
    let wall = Date.now();
    const clock = spyOn(performance, "now").mockImplementation(() => monotonic);
    const date = spyOn(Date, "now").mockImplementation(() => wall);
    const bodies: string[] = [];
    const sending = spyOn(globalThis, "fetch").mockImplementation(
      Object.assign(
        async (request: string | URL | Request, init?: RequestInit) => {
          bodies.push(await requestBody(request, init));
          if (bodies.length === 1 && mode === "deadline") monotonic = 30_001;
          return new Response(null, {
            status: bodies.length === 1 && mode === "cooldown" ? 429 : 200,
            headers: { "Retry-After": "120" },
          });
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
      exporter.enqueue({ ...completedCall, error_type: "" });
      for (let n = 0; n < 101; n++)
        exporter.enqueue({ ...completedCall, call_id: String(n) });
      await exporter.forceFlush();
      const firstFlush = bodies.length;
      monotonic = 0;
      wall += 120_001;
      await exporter.shutdown();
      expect({
        firstFlush,
        sizes: bodies.map(
          (body) => (JSON.parse(body) as { calls: McpCall[] }).calls.length,
        ),
        identical: mode === "deadline" || bodies[0] === bodies[1],
      }).toEqual({
        firstFlush: 1,
        sizes: mode === "deadline" ? [100, 1] : [100, 100, 1],
        identical: true,
      });
    } finally {
      sending.mockRestore();
      clock.mockRestore();
      date.mockRestore();
    }
  },
);

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

test("delivery bounds the queue, batches calls and stops retrying permanent errors", async () => {
  useExporter();
  const { bodies } = captureNativeRequests([403, 403]);
  const warnings = spyOn(Logger, "warning").mockImplementation(() => {});
  cleanups.push(() => {
    warnings.mockRestore();
  });
  const exporter = new McpCallExporter({
    apiUrl: "http://localhost",
    apiKey: "key",
    organizationId: "org",
    projectId: "project",
  });
  for (let n = 0; n < 1010; n++)
    exporter.enqueue({ ...completedCall, call_id: String(n) });
  await exporter.shutdown();
  exporter.enqueue(completedCall);
  expect({
    sizes: bodies.map((body) => JSON.parse(body).calls.length),
    warnings: warnings.mock.calls.length,
  }).toEqual({ sizes: Array(10).fill(100), warnings: 1 });
});

describe("cancelled calls", () => {
  test("records a cancelled call as neither success nor failure", async () => {
    const exporter = useExporter();
    const { provider, bodies } = captureNativeRequests();
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
    const attributes = exporter
      .getFinishedSpans()
      .find((span) => span.name === "tools/call slow")?.attributes;
    await provider.forceFlush();
    const calls = bodies.flatMap(
      (body) => (JSON.parse(body) as { calls: McpCall[] }).calls,
    );
    expect({
      cancelled: attributes?.["judgment.mcp.cancelled"],
      errorType: attributes?.["error.type"],
      native: calls.map((call) => [call.outcome, call.error_type]),
    }).toEqual({
      cancelled: "true",
      errorType: undefined,
      native: [["cancelled", undefined]],
    });
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
