import { afterEach, describe, expect, spyOn, test } from "bun:test";
import {
  Client as ClientV2,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { Client as ClientV1 } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer as McpServerV1 } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Server as ServerV1 } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  McpServer as McpServerV2,
  createMcpHandler,
  fromJsonSchema,
  Server as ServerV2,
} from "@modelcontextprotocol/server";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { z } from "zod/v4";
import { z as z3 } from "zod/v3";
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
  withoutAgentArguments,
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
      inputSchema: z.object({
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

async function connectV1(
  options: InstrumentMcpServerOptions,
  register = registerTools,
) {
  const server = new McpServerV1({ name: "greeter", version: "1" });
  register(server);
  instrumentMcpServer(server, options);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new ClientV1({ name: "test-client", version: "1" });
  await client.connect(clientSide);
  return client;
}

describe.each(["1", "2"])("low-level MCP %s", (version) => {
  test.each(["discovery", "sync", "async"])(
    "injects safely with %s lookup",
    async (lookup) => {
      useExporter();
      const tool = {
        name: "lookup",
        inputSchema: {
          type: "object" as const,
          properties: { intent: { type: "string" } },
          additionalProperties: false,
        },
        outputSchema: {
          type: "object" as const,
          properties: { ok: { type: "boolean" } },
          additionalProperties: false,
        },
      };
      const received: unknown[] = [];
      const resolved: string[] = [];
      const resolve = (name: string) => {
        resolved.push(name);
        return tool;
      };
      const options: InstrumentMcpServerOptions = {
        intentArgument: "intent",
        resolveOriginalTool:
          lookup === "discovery"
            ? undefined
            : lookup === "sync"
              ? resolve
              : async (name) => await Promise.resolve(resolve(name)),
      };
      const call = (request: { params: { arguments?: unknown } }) => {
        received.push(request.params.arguments);
        return { content: [], structuredContent: { ok: true } };
      };
      let client: ClientV1 | ClientV2;
      if (version === "1") {
        const server = new ServerV1(
          { name: "low", version: "1" },
          { capabilities: { tools: {} } },
        );
        instrumentMcpServer(server, options);
        server.setRequestHandler(ListToolsRequestSchema, () => ({
          tools: [tool],
        }));
        server.setRequestHandler(CallToolRequestSchema, call);
        const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
        await server.connect(serverSide);
        client = new ClientV1({ name: "test", version: "1" });
        await client.connect(clientSide);
        cleanups.push(() => server.close());
      } else {
        const handler = createMcpHandler(() => {
          const server = new ServerV2(
            { name: "low", version: "1" },
            { capabilities: { tools: {} } },
          );
          instrumentMcpServer(server, options);
          server.setRequestHandler("tools/list", () => ({
            tools: [tool],
          }));
          server.setRequestHandler("tools/call", call);
          return server;
        });
        client = new ClientV2({ name: "test", version: "1" });
        await client.connect(
          new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
            fetch: (url, init) => handler.fetch(new Request(String(url), init)),
          }),
        );
      }
      cleanups.push(() => client.close());
      const listed = await client.listTools();
      const result = (await client.callTool({
        name: "lookup",
        arguments: { intent: "business", llm_model: "model" },
      })) as Result;
      const id = result.structuredContent?._judgment?.conversation_id;
      await client.callTool({
        name: "lookup",
        arguments: { intent: "business", conversation_id: id },
      });
      expect({
        properties: Object.keys(
          listed.tools[0]!.inputSchema.properties ?? {},
        ).sort(),
        received,
        resolved,
        handoff: typeof id,
      }).toEqual({
        properties: ["conversation_id", "intent", "llm_model"],
        received: [{ intent: "business" }, { intent: "business" }],
        resolved: lookup === "discovery" ? [] : ["lookup", "lookup"],
        handoff: "string",
      });
    },
  );
});

test.each([
  { sessionId: "transport-session" },
  { requestInfo: { headers: { "Mcp-Session-Id": "transport-session" } } },
  {
    sessionId: "",
    requestInfo: { headers: { "mcp-session-id": "transport-session" } },
  },
])(
  "minted conversation groups first and echoed calls ahead of transport: %j",
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
    const handle = JSON.parse(result.content.at(-1).text).conversation_id;
    const echoed = await handlers.get("tools/call")(
      {
        method: "tools/call",
        params: {
          name: "greet",
          arguments: { name: "Alice", conversation_id: handle },
        },
      },
      context,
    );
    const failed = await handlers.get("tools/call")(
      {
        method: "tools/call",
        params: { name: "greet", arguments: { name: "Alice", fail: true } },
      },
      context,
    );
    expect({
      callbackSession,
      output: result.structuredContent,
      session: call?.attributes["judgment.session_id"],
      source: call?.attributes["judgment.mcp.conversation_id_source"],
      handoff: typeof handle,
      laterContentLengths: [echoed.content.length, failed.content.length],
      echoedSession: exporter
        .getFinishedSpans()
        .find(
          (span) =>
            span.attributes["judgment.mcp.conversation_id_source"] === "echoed",
        )?.attributes["judgment.session_id"],
    }).toEqual({
      callbackSession: "transport-session",
      output: {
        ok: true,
        _judgment: {
          conversation_id: handle,
          note: "Pass this conversation_id on later tool calls in this conversation.",
        },
      },
      session: handle,
      source: "minted",
      handoff: "string",
      laterContentLengths: [1, 2],
      echoedSession: handle,
    });
  },
);

test.each([
  { register: registerTools, handoff: true },
  ...[true, false].map((handoff) => ({
    handoff,
    register: (server: McpServerV1) => {
      server.registerTool(
        "greet",
        {
          inputSchema: z3.object({ name: z3.string() }),
          outputSchema: z3
            .object({ ok: z3.boolean() })
            .catchall(handoff ? z3.never() : z3.number()),
        },
        () => ({ content: [], structuredContent: { ok: true } }),
      );
    },
  })),
])(
  "repeated calls avoid listing discovery and duplicate protocol instrumentation",
  async ({ register, handoff }) => {
    const exporter = useExporter();
    const server = new McpServerV1({ name: "greeter", version: "1" });
    register(server);
    const handlers = Reflect.get(server.server, "_requestHandlers");
    const list = handlers.get("tools/list");
    let listings = 0;
    handlers.set("tools/list", (...args: unknown[]) => {
      listings++;
      return list(...args);
    });
    instrumentMcpServer(server);
    instrumentMcpServer(server.server);
    const warning = spyOn(Logger, "warning").mockImplementation(() => {});
    cleanups.push(() => {
      warning.mockRestore();
    });
    instrumentMcpServer(server, { captureInput: true });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new ClientV1({ name: "test", version: "1" });
    await client.connect(clientSide);
    cleanups.push(() => client.close());
    await client.listTools();
    const first = await client.callTool({
      name: "greet",
      arguments: { name: "Alice" },
    });
    const second = await client.callTool({
      name: "greet",
      arguments: { name: "Bob" },
    });
    expect({
      listings,
      warnings: warning.mock.calls,
      captured: exporter
        .getFinishedSpans()
        .some((span) => "judgment.input" in span.attributes),
      calls: exporter
        .getFinishedSpans()
        .filter((span) => span.name === "tools/call greet").length,
      outputs: [first, second].map(
        (result) => (result.structuredContent as { ok: boolean }).ok,
      ),
      handoffs: [first, second].map(
        (result) => "_judgment" in (result.structuredContent as object),
      ),
    }).toEqual({
      listings: 1,
      warnings: [
        [
          "MCP server is already instrumented with different options; keeping the original configuration.",
        ],
      ],
      captured: false,
      calls: 2,
      outputs: [true, true],
      handoffs: [handoff, handoff],
    });
  },
);

test.each([connectV1, connectV2])(
  "raw output shapes hand off IDs before and after listing (%p)",
  async (connect) => {
    const client = await connect({}, (server) =>
      (server as McpServerV1).registerTool(
        "greet",
        {
          inputSchema: z.object({ name: z.string() }),
          outputSchema: { ok: z.boolean() },
        },
        () => ({ content: [], structuredContent: { ok: true } }),
      ),
    );
    cleanups.push(() => client.close());
    const call = () =>
      client.callTool({ name: "greet", arguments: { name: "A" } });
    const first = await call();
    await client.listTools();
    const second = await call();
    expect(
      [first, second].map((result) => ({
        ok: (result as Result).structuredContent?.ok,
        hasConversationId:
          typeof (result as Result).structuredContent?._judgment
            ?.conversation_id === "string",
      })),
    ).toEqual([
      { ok: true, hasConversationId: true },
      { ok: true, hasConversationId: true },
    ]);
  },
);

test("immutable output schemas are converted once across repeated calls", async () => {
  const output = z.object({ ok: z.boolean() });
  const conversion = spyOn(output["~standard"].jsonSchema, "output");
  cleanups.push(() => conversion.mockRestore());
  const server = new McpServerV1({ name: "conversion", version: "1" });
  server.registerTool(
    "greet",
    { inputSchema: z.object({}), outputSchema: output },
    () => ({ content: [], structuredContent: { ok: true } }),
  );
  instrumentMcpServer(server);
  const call = Reflect.get(server.server, "_requestHandlers").get("tools/call");
  for (let i = 0; i < 3; i++)
    await call(
      { method: "tools/call", params: { name: "greet", arguments: {} } },
      {},
    );
  expect(conversion.mock.calls.length).toBe(1);
});

test.each(["cached", "pages", "timeout"])(
  "low-level ownership reuse and bounded discovery: %s",
  async (mode) => {
    const tool = {
      name: "lookup",
      inputSchema: {
        type: "object",
        properties: { intent: { type: "string" } },
        additionalProperties: false,
      },
    };
    let listings = 0;
    let received: unknown;
    const protocol = {
      _requestHandlers: new Map<
        string,
        (
          request: {
            method?: string;
            params?: { name?: string; arguments?: unknown };
          },
          context: object,
        ) => Promise<unknown>
      >([
        [
          "tools/list",
          async () => {
            listings++;
            if (mode === "cached") {
              if (listings > 1) throw new Error("listing unavailable");
              return { tools: [tool] };
            }
            if (mode === "timeout") await new Promise(() => {});
            return { tools: [], nextCursor: String(listings) };
          },
        ],
        [
          "tools/call",
          (request) => {
            received = request.params?.arguments;
            return Promise.resolve({ content: [], isError: true });
          },
        ],
      ]),
    };
    instrumentMcpServer(protocol);
    if (mode === "cached")
      await protocol._requestHandlers.get("tools/list")!({}, {});
    const args = { intent: "business", llm_model: "model" };
    await Promise.all(
      Array.from({ length: 3 }, () =>
        protocol._requestHandlers.get("tools/call")!(
          { method: "tools/call", params: { name: "lookup", arguments: args } },
          {},
        ),
      ),
    );
    await protocol._requestHandlers.get("tools/call")!(
      { method: "tools/call", params: { name: "lookup", arguments: args } },
      {},
    );
    expect({ received, listings }).toEqual({
      received: mode === "cached" ? { intent: "business" } : args,
      listings: mode === "pages" ? 100 : 1,
    });
  },
);

test("low-level ownership refreshes on notifications and handler replacement", async () => {
  const server = new ServerV1(
    { name: "changing", version: "1" },
    { capabilities: { tools: { listChanged: true } } },
  );
  server.notification = () => Promise.resolve();
  let properties = {};
  const listing = () => ({
    tools: [
      {
        name: "lookup",
        inputSchema: {
          type: "object",
          properties,
          additionalProperties: false,
        },
      },
    ],
  });
  server.setRequestHandler(ListToolsRequestSchema, listing);
  const received: unknown[] = [];
  server.setRequestHandler(CallToolRequestSchema, (request) => {
    received.push(request.params.arguments);
    return { content: [], isError: true };
  });
  instrumentMcpServer(server);
  const handlers = Reflect.get(server, "_requestHandlers");
  const call = () =>
    handlers.get("tools/call")(
      {
        method: "tools/call",
        params: {
          name: "lookup",
          arguments: { intent: "business", llm_model: "model" },
        },
      },
      {},
    );
  await handlers.get("tools/list")({ method: "tools/list" }, {});
  await call();
  properties = { intent: { type: "string" } };
  await server.sendToolListChanged();
  await call();
  properties = { intent: { type: "string" }, llm_model: { type: "string" } };
  server.setRequestHandler(ListToolsRequestSchema, listing);
  await call();
  expect(received).toEqual([
    {},
    { intent: "business" },
    { intent: "business", llm_model: "model" },
  ]);
});

test.each(["eviction", "listing", "notification", "unstable"])(
  "in-flight discovery preserves call ownership after %s",
  async (change) => {
    const server = new ServerV1(
      { name: "changing", version: "1" },
      { capabilities: { tools: { listChanged: true } } },
    );
    server.notification = () => Promise.resolve();
    let properties = {};
    let listings = 0;
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const schema = {
        type: "object",
        properties,
        additionalProperties: false,
      };
      if (++listings === 1) {
        if (change !== "eviction") properties = { intent: { type: "string" } };
        if (change === "listing" || change === "eviction")
          await handlers.get("tools/list")({ method: "tools/list" }, {});
        else await server.sendToolListChanged();
      } else if (change === "eviction")
        return {
          tools: Array.from({ length: 1_000 }, (_, index) => ({
            name: `other-${index}`,
            inputSchema: schema,
          })),
        };
      else if (change === "unstable") await server.sendToolListChanged();
      return { tools: [{ name: "lookup", inputSchema: schema }] };
    });
    const received: unknown[] = [];
    server.setRequestHandler(CallToolRequestSchema, (request) => {
      received.push(request.params.arguments);
      return { content: [] };
    });
    instrumentMcpServer(server);
    const handlers = Reflect.get(server, "_requestHandlers");
    await handlers.get("tools/call")(
      {
        method: "tools/call",
        params: { name: "lookup", arguments: { intent: "business" } },
      },
      {},
    );
    expect({ received, listings }).toEqual({
      received: change === "eviction" ? [{}] : [{ intent: "business" }],
      listings: 2,
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
  expect(result.structuredContent).toEqual({
    ok: true,
    _judgment: {
      conversation_id: expect.any(String),
      note: "Pass this conversation_id on later tool calls in this conversation.",
    },
  });
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
    arguments: { name: "Alice", intent: "business-owned" },
  });
  expect(received).toEqual({ name: "Alice", intent: "business-owned" });
});

async function connectV2(
  options: InstrumentMcpServerOptions,
  register = registerTools,
) {
  const handler = createMcpHandler(() => {
    const server = new McpServerV2({ name: "greeter", version: "1" });
    register(server);
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
  test.each([true, false])(
    "explicit names reuse declared fields and inject absent fields (injection=%s)",
    async (injectAgentArguments) => {
      const exporter = useExporter();
      const received: unknown[] = [];
      const args = {
        intent: "find tickets",
        llm_model: "agent-model",
        chat_id: "customer-chat",
      };
      const client = await connect(
        {
          injectAgentArguments,
          intentArgument: "intent",
          modelArgument: "llm_model",
          conversationIdArgument: "chat_id",
          captureInput: true,
          redact: (value) => value.toUpperCase(),
        },
        (server) => {
          for (const name of ["owned", "injected"])
            (server as McpServerV1).registerTool(
              name,
              {
                inputSchema:
                  name === "owned"
                    ? z.strictObject({
                        intent: z.string().optional(),
                        llm_model: z.string().optional(),
                        chat_id: z.string().optional(),
                      })
                    : z.strictObject({}),
                outputSchema: z.strictObject({ ok: z.boolean() }),
              },
              (input) => {
                received.push(input);
                return {
                  content: [{ type: "text", text: "ok" }],
                  structuredContent: { ok: true },
                };
              },
            );
        },
      );
      cleanups.push(() => client.close());
      const listing = await client.listTools();
      await client.callTool({ name: "owned", arguments: args });
      await client.callTool({ name: "owned", arguments: {} });
      const first = await client.callTool({
        name: "injected",
        arguments: injectAgentArguments
          ? { intent: "find tickets", llm_model: "agent-model" }
          : {},
      });
      const handle = (first.content as { text?: string }[])
        .map((item) => item.text)
        .find((text) => text?.startsWith('{"conversation_id"'));
      if (injectAgentArguments)
        await client.callTool({
          name: "injected",
          arguments: { chat_id: JSON.parse(handle!).conversation_id },
        });
      const calls = exporter
        .getFinishedSpans()
        .filter((span) => span.name.startsWith("tools/call"));
      const owned = listing.tools.find((tool) => tool.name === "owned")!;
      const injected = listing.tools.find((tool) => tool.name === "injected")!;
      expect({
        received,
        ownedFields: Object.keys(owned.inputSchema.properties ?? {}).sort(),
        injectedFields: Object.keys(
          injected.inputSchema.properties ?? {},
        ).sort(),
        outputFields: Object.keys(owned.outputSchema?.properties ?? {}),
        telemetry: [
          "judgment.mcp.intent",
          "judgment.llm.model",
          "judgment.session_id",
          "judgment.mcp.conversation_id_source",
          "judgment.input",
        ].map((key) => calls[0]?.attributes[key]),
        missingIntent: calls[1]?.attributes["judgment.mcp.intent"],
        injectedInput: calls[2]?.attributes["judgment.input"],
        handoff: handle === undefined ? undefined : JSON.parse(handle).note,
        continuity: injectAgentArguments
          ? calls[2]?.attributes["judgment.session_id"] ===
            calls[3]?.attributes["judgment.session_id"]
          : undefined,
      }).toEqual({
        received: injectAgentArguments ? [args, {}, {}, {}] : [args, {}, {}],
        ownedFields: ["chat_id", "intent", "llm_model"],
        injectedFields: injectAgentArguments
          ? ["chat_id", "intent", "llm_model"]
          : [],
        outputFields: ["ok"],
        telemetry: [
          "FIND TICKETS",
          "agent-model",
          "customer-chat",
          "provided",
          JSON.stringify(args),
        ],
        missingIntent: undefined,
        injectedInput: "{}",
        handoff: injectAgentArguments
          ? "Pass this chat_id on later tool calls in this conversation."
          : undefined,
        continuity: injectAgentArguments ? true : undefined,
      });
    },
  );

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
        intent: "Greeting",
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
      arguments: { name: SECRET, intent: "Greeting" },
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
      fields: ["fail", "intent", "llm_model", "name"],
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
    const result = (await client.callTool({
      name: "greet",
      arguments: { name: SECRET, fail: true },
    })) as { isError?: boolean; content: { type: string; text: string }[] };
    const handle = JSON.parse(
      result.content[result.content.length - 1]!.text,
    ).conversation_id;
    await client.callTool({
      name: "greet",
      arguments: { name: "retry", conversation_id: handle },
    });
    const call = exporter
      .getFinishedSpans()
      .find((s) => s.attributes["mcp.method.name"] === "tools/call");
    expect([
      call?.attributes["judgment.mcp.outcome"],
      call?.attributes["judgment.mcp.error_message"],
      result.isError,
      result.content.slice(0, -1),
      typeof handle,
      exporter
        .getFinishedSpans()
        .find(
          (span) =>
            span.attributes["judgment.mcp.conversation_id_source"] === "echoed",
        )?.attributes["judgment.session_id"],
    ]).toEqual([
      "error",
      "[redacted]",
      true,
      [{ type: "text", text: `declined ${SECRET} for a@b.co` }],
      "string",
      handle,
    ]);
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
    required: ["intent"],
    patternProperties: { "^llm_": { type: "number" } },
  };
  const tool = withAgentArguments({ name: "lookup", inputSchema: schema });
  expect({
    owned: declaredArguments(schema),
    added: Object.keys(tool.inputSchema.properties ?? {}),
  }).toEqual({
    owned: ["intent", "llm_model"],
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
  const oversizedCallbacks: string[] = [];
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
    oversizedSource: capturePayload(
      { text: "x".repeat(128 * 1024) },
      "input",
      (_, field) => {
        oversizedCallbacks.push(field);
        return {};
      },
    ),
    oversizedCallbacks,
    null: capturePayload(null, "output"),
  }).toEqual({
    original: { token: SECRET },
    captured: { token: "safe" },
    failure: undefined,
    oversized: undefined,
    oversizedSource: undefined,
    oversizedCallbacks: [],
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
    { properties: {}, additionalProperties: { type: "integer" } },
    { additionalProperties: { type: "integer" } },
  ])("leaves incompatible output schemas alone: %j", (constraints) => {
    expect(
      withConversationOutputSchema({
        type: "object",
        properties: { ok: { type: "boolean" } },
        ...constraints,
      }),
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
    readReportedArguments({ intent: "Email a@b.co" }, new Set()).intent,
    readReportedArguments({ intent: "a".repeat(1000) }, new Set()).intent,
  ]).toEqual(["Email a@b.co", "a".repeat(500)]);
});

test("a custom model argument leaves a tool's llm_model untouched", () => {
  const names = { model: "judgment_llm_model" };
  const tool = {
    inputSchema: {
      type: "object",
      properties: { llm_model: { type: "string" } },
    },
  };
  const updated = withAgentArguments(tool, true, names);
  const declared = new Set(["llm_model"]);
  const args = {
    llm_model: "tool-model",
    judgment_llm_model: "agent-model",
    conversation_id: "extra",
  };
  expect({
    fields: Object.keys(updated.inputSchema.properties).sort(),
    model: readReportedArguments(args, declared, names).model,
    missing: readReportedArguments({ llm_model: "tool-model" }, declared, names)
      .model,
    defaultCollision: readReportedArguments(args, declared).model,
    business: withoutAgentArguments(args, declared, names),
    disabledHandoff: withoutAgentArguments(args, declared, names, false),
  }).toEqual({
    fields: ["conversation_id", "intent", "judgment_llm_model", "llm_model"],
    model: "agent-model",
    missing: undefined,
    defaultCollision: undefined,
    business: { llm_model: "tool-model" },
    disabledHandoff: { llm_model: "tool-model", conversation_id: "extra" },
  });
});
