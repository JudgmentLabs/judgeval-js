import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import {
  SpanKind,
  SpanStatusCode,
  defaultTextMapGetter,
  isSpanContextValid,
  trace,
  type Attributes,
  type Context,
  type Span,
} from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { JudgmentTracerProvider } from "../../trace/JudgmentTracerProvider";
import { Logger } from "../../utils/logger";
import { VERSION } from "../../version";
import { capturePayload, McpCallExporter, type McpCall } from "./exporter";
export type { McpCall } from "./exporter";
import {
  isAgentArgument,
  mintConversationId,
  readReportedArguments,
  withAgentArguments,
  withConversationIdPrompt,
  withConversationOutputSchema,
  withoutAgentArguments,
} from "./agent-arguments";

const TRACER_NAME = "judgeval-mcp";
const MAX_ERROR_MESSAGE_LENGTH = 1_000;
const MAX_RECORDED_KEYS = 30;
const MAX_RECORDED_KEY_LENGTH = 64;
const CLIENT_INFO_META_KEY = "io.modelcontextprotocol/clientInfo";
const PROTOCOL_VERSION_META_KEY = "io.modelcontextprotocol/protocolVersion";
const INVALID_PARAMS_CODE = -32602;
const UNKNOWN_TOOL = /^(?:MCP error -?\d+: )?Tool \S+ (not found|disabled)/;
const INVALID_INPUT = /^(?:MCP error -?\d+: )?Input validation error/;
// Words only: anything with digits could be a token rather than an error code.
const PUBLIC_ERROR_CODE = /^[A-Za-z][A-Za-z_.:-]{0,39}$/;

const propagator = new W3CTraceContextPropagator();

/** Who a call acts for. Hash these if your identifiers are sensitive. */
export interface McpCaller {
  readonly userId?: string | null;
  readonly customerId?: string | null;
}

/** What {@link InstrumentMcpServerOptions.identify} can read about a request. */
export interface McpRequestInfo {
  readonly sessionId: string | undefined;
  readonly headers: Readonly<Record<string, string>>;
  /** The transport's authentication result, when the SDK provides one. */
  readonly authInfo: unknown;
}

/** Options for {@link instrumentMcpServer}. */
export interface InstrumentMcpServerOptions {
  /** Also create OTel request spans. Native call events are always exported. Default false. */
  readonly recordSpans?: boolean;
  /** Capture business arguments/results. Both default false. */
  readonly captureInput?: boolean;
  readonly captureOutput?: boolean;
  /** Receives a detached JSON snapshot. Throw or return undefined to omit it. */
  readonly redactPayload?: (
    value: unknown,
    field: "input" | "output",
  ) => unknown;
  /** Authoritative logical session from your application, independent of transport. */
  readonly sessionId?: (info: McpRequestInfo) => string | undefined;
  /** Defaults to the name the server advertises. */
  readonly serverName?: string;
  /** The deployed build, used to compare releases. */
  readonly serverBuild?: string;
  /**
   * Adds optional `context`, `llm_model` and `conversation_id` arguments to each
   * tool's published schema, removes them before your handler runs, and returns
   * a conversation ID in tool results when the call has no session. Set to false
   * to leave your tools and their results exactly as they are, at the cost of
   * agent-reported intent and model, and sessions for clients that send no ID.
   * @defaultValue true
   */
  readonly injectAgentArguments?: boolean;
  /** Attaches the end user or customer once a call finishes. */
  readonly identify?: (info: McpRequestInfo) => McpCaller | undefined;
  /** Records the text of a failure. Off keeps only its type. @defaultValue true */
  readonly captureErrorMessages?: boolean;
  /** Rewrites failure messages and reported intent before they leave the process. */
  readonly redact?: (text: string) => string;
}

interface CallRecord {
  error: unknown;
  caller: McpCaller | undefined;
  identified?: boolean;
  failure?: { type: string; message?: string };
}

interface McpRequest {
  readonly method?: string;
  readonly id?: string | number;
  readonly params?: {
    readonly name?: string;
    readonly uri?: string;
    readonly arguments?: Readonly<Record<string, unknown>>;
    readonly _meta?: Readonly<Record<string, unknown>>;
  };
}

interface HandlerContext {
  readonly sessionId?: string;
  readonly requestId?: string | number;
  readonly signal?: AbortSignal;
  readonly authInfo?: unknown;
  readonly requestInfo?: {
    readonly headers?: Readonly<Record<string, string | string[] | undefined>>;
  };
  readonly mcpReq?: {
    readonly id?: string | number;
    readonly signal?: AbortSignal;
  };
  readonly http?: {
    readonly authInfo?: unknown;
    readonly req?: { readonly headers?: Headers };
  };
}

interface McpResult {
  readonly isError?: boolean;
  readonly content?: readonly { readonly text?: string }[];
  readonly structuredContent?: unknown;
  readonly tools?: readonly Readonly<Record<string, unknown>>[];
}

type RequestHandler = (
  request: McpRequest,
  context: HandlerContext,
) => Promise<McpResult>;

interface ProtocolServer {
  _requestHandlers?: Map<string, RequestHandler>;
  _serverInfo?: { readonly name?: string; readonly version?: string };
  getClientVersion?: () =>
    | { readonly name?: string; readonly version?: string }
    | undefined;
}

interface RegisteredTool {
  readonly description?: string;
  readonly inputSchema?: unknown;
}

/** An `McpServer` or low-level `Server` from either supported MCP SDK. */
export type InstrumentableMcpServer = object;

interface ToolContract {
  readonly declared: ReadonlySet<string>;
  readonly hash: string;
  /** Accepts unknown keys, so an added argument could change what the tool receives. */
  readonly open: boolean;
}

const records = new AsyncLocalStorage<CallRecord>();
const instrumented = new WeakSet<object>();
const exporters = new WeakMap<object, McpCallExporter>();
// Keyed by schema because an update replaces it, then by tool, because two tools
// can share one schema object.
const contracts = new WeakMap<object, Map<string, ToolContract | null>>();

/**
 * Records the original error before you map it to a public tool error. Its
 * class name becomes the call's `error.type`, so named error classes tell you
 * why calls fail.
 */
export function markMcpCallError(error: unknown): void {
  const record = records.getStore();
  if (record !== undefined) record.error = error;
}

/** Attaches the end user or customer of the current MCP call. */
export function setMcpCaller(caller: McpCaller): void {
  const record = records.getStore();
  if (record !== undefined) record.caller = { ...record.caller, ...caller };
}

/** Capture an already-completed call from a custom server. Supplied payloads opt in to capture. */
export function captureMcpCall(
  call: Omit<McpCall, "call_id"> & { call_id?: string },
  redactPayload?: InstrumentMcpServerOptions["redactPayload"],
): void {
  attempt(() =>
    activeExporter()?.enqueue({
      ...call,
      call_id: call.call_id ?? randomUUID(),
      environment_name:
        call.environment_name ??
        JudgmentTracerProvider.getInstance().getActiveTracer()?.environment ??
        undefined,
      input: capturePayload(call.input, "input", redactPayload),
      output: capturePayload(call.output, "output", redactPayload),
    }),
  );
}

/**
 * Exports completed tool calls as native MCP events using the active tracer's
 * configuration. Optional OTel spans join the caller's `_meta` trace context.
 *
 * Call it once per server, after `Tracer.init()`. Supports
 * `@modelcontextprotocol/sdk` 1.x and `@modelcontextprotocol/server` 2.x. Those
 * SDKs have no public way to wrap handlers, so this replaces entries in a private
 * map. If an upgrade removes it, tracing turns off with a warning. Tracing
 * failures never affect a call.
 *
 * Business arguments and results are opt-in; use captureInput,
 * captureOutput and redactPayload to control sensitive data. Call
 * Tracer.forceFlush()/shutdown() before exiting. See
 * {@link InstrumentMcpServerOptions.injectAgentArguments} for the one change it
 * makes to your server by default.
 */
export function instrumentMcpServer(
  server: InstrumentableMcpServer,
  options: InstrumentMcpServerOptions = {},
): void {
  try {
    instrument(server, options);
  } catch (error) {
    Logger.warning(`Could not instrument MCP server: ${String(error)}`);
  }
}

function instrument(
  server: InstrumentableMcpServer,
  options: InstrumentMcpServerOptions,
): void {
  if (instrumented.has(server)) return;
  const highLevel = server as {
    readonly server?: ProtocolServer;
    readonly _registeredTools?: Readonly<Record<string, RegisteredTool>>;
  };
  const protocol = highLevel.server ?? (server as ProtocolServer);
  const handlers = protocol._requestHandlers;
  if (!(handlers instanceof Map)) {
    Logger.warning(
      "Could not instrument MCP server: this MCP SDK version has no handler map. Calls still run, but aren't traced.",
    );
    return;
  }
  instrumented.add(server);

  // Stripping needs proof of what a tool declares, which only `McpServer` has.
  const registry =
    highLevel.server === undefined ? undefined : highLevel._registeredTools;
  const inject =
    (options.injectAgentArguments ?? true) && registry !== undefined;
  const structuredTools = new Set<string>();
  const listTools = handlers.get("tools/list");
  const wrap = (method: string, handler: RequestHandler): RequestHandler =>
    traced(
      method,
      handler,
      protocol,
      registry,
      options,
      inject,
      structuredTools,
      listTools,
    );

  for (const [method, handler] of handlers) {
    handlers.set(method, wrap(method, handler));
  }
  // `McpServer` registers some handlers only when the first tool is added.
  const set = handlers.set.bind(handlers);
  handlers.set = (method, handler) => set(method, wrap(method, handler));
}

function traced(
  method: string,
  handler: RequestHandler,
  protocol: ProtocolServer,
  registry: Readonly<Record<string, RegisteredTool>> | undefined,
  options: InstrumentMcpServerOptions,
  inject: boolean,
  structuredTools: Set<string>,
  listTools: RequestHandler | undefined,
): RequestHandler {
  return async (request, context) => {
    const prepared = attempt(() =>
      prepareCall(
        method,
        request,
        context,
        protocol,
        registry,
        options,
        inject,
      ),
    );
    if (prepared === undefined) {
      const stripped =
        attempt(() => withoutInjected(method, request, registry, inject)) ??
        request;
      const result = await handler(stripped, context);
      return method === "tools/list" && inject
        ? listWithArguments(result, registry, structuredTools)
        : result;
    }
    const record: CallRecord = {
      error: undefined,
      caller: undefined,
    };
    const started =
      options.recordSpans === true
        ? attempt(() => startCallSpan(method, request, prepared))
        : undefined;
    const complete = attempt(() => captureCall(prepared, record, options));
    const run = () =>
      records.run(record, () => handler(prepared.request, context));
    try {
      const result = await (started === undefined
        ? run()
        : JudgmentTracerProvider.getInstance().withContext(
            trace.setSpan(started.parent, started.span),
            run,
          ));
      attempt(() => complete?.(result, context, started?.span));
      if (started !== undefined) {
        finish(started.span, record, result, context, options);
      }
      if (method === "tools/list" && inject) {
        return listWithArguments(result, registry, structuredTools);
      }
      // Stateless HTTP servers may create a fresh server for each request.
      // Read that instance's published schema before annotating its result.
      if (
        prepared.mintedConversationId !== undefined &&
        result.structuredContent !== undefined &&
        listTools !== undefined
      ) {
        const listed = await listTools({ method: "tools/list" }, context).catch(
          () => undefined,
        );
        if (listed !== undefined)
          listWithArguments(listed, registry, structuredTools);
      }
      return prepared.mintedConversationId === undefined
        ? result
        : withConversationIdPrompt(
            result,
            prepared.mintedConversationId,
            structuredTools,
            request.params?.name ?? "",
          );
    } catch (error) {
      record.error ??= error;
      attempt(() => complete?.(undefined, context, started?.span));
      if (started !== undefined) {
        finish(started.span, record, undefined, context, options);
      }
      throw error;
    }
  };
}

interface PreparedCall {
  readonly request: McpRequest;
  readonly attributes: Attributes;
  readonly mintedConversationId: string | undefined;
}

function captureCall(
  prepared: PreparedCall,
  record: CallRecord,
  options: InstrumentMcpServerOptions,
) {
  const { attributes, request } = prepared;
  if (attributes["mcp.method.name"] !== "tools/call") return undefined;
  const exporter = activeExporter();
  if (exporter === undefined) return undefined;
  const args = request.params?.arguments ?? {};
  const argumentKeys = Object.keys(args)
    .filter(Boolean)
    .slice(0, 100)
    .map((key) => key.slice(0, 256));
  const input =
    options.captureInput === true
      ? capturePayload(args, "input", options.redactPayload)
      : undefined;
  const environment =
    JudgmentTracerProvider.getInstance().getActiveTracer()?.environment;
  const timestamp = new Date().toISOString();
  const start = performance.now();
  let completed = false;
  return (
    result: McpResult | undefined,
    context: HandlerContext,
    source?: Span,
  ): void => {
    if (completed) return;
    completed = true;
    const duration = Math.max(0, performance.now() - start);
    const caller = identifyCaller(record, context, options);
    const cancelled =
      (context.signal ?? context.mcpReq?.signal)?.aborted === true;
    const failed = result === undefined || result.isError === true;
    const span = source?.spanContext();
    const failure =
      failed && !cancelled ? failureOf(record, result, options) : undefined;
    const text = (key: string, limit = 256) =>
      stringOrUndefined(attributes[key])?.slice(0, limit);
    const output =
      options.captureOutput === true && result !== undefined
        ? capturePayload(result, "output", options.redactPayload)
        : undefined;
    const metadata: Record<string, unknown> = Object.fromEntries(
      Object.entries(attributes)
        .filter(([key]) =>
          [
            "mcp.session.id",
            "mcp.protocol.version",
            "jsonrpc.request.id",
            "judgment.mcp.server.version",
            "judgment.mcp.server.build",
            "judgment.mcp.client.version",
            "judgment.mcp.contract_hash",
            "judgment.mcp.sdk_version",
            "judgment.mcp.conversation_id_source",
          ].includes(key),
        )
        .map(([key, value]) => [key, String(value).slice(0, 512)]),
    );
    if (caller.customerId)
      metadata["customer_id"] = caller.customerId.slice(0, 512);
    if (options.captureInput === true && input === undefined)
      metadata["input_omitted"] = true;
    if (
      options.captureOutput === true &&
      result !== undefined &&
      output === undefined
    )
      metadata["output_omitted"] = true;
    exporter.enqueue({
      call_id: randomUUID(),
      timestamp,
      duration_ms: duration,
      outcome: cancelled ? "cancelled" : failed ? "error" : "success",
      server_name: text("judgment.mcp.server.name") ?? "mcp",
      tool_name: (request.params?.name || "unknown").slice(0, 256),
      session_id: text("judgment.mcp.conversation_id", 512),
      client_name: text("judgment.mcp.client.name"),
      intent: text("judgment.mcp.intent", 2048),
      model: text("judgment.mcp.model"),
      user_id: caller.userId?.slice(0, 512) || undefined,
      environment_name: environment?.slice(0, 256) || undefined,
      argument_keys: argumentKeys,
      input,
      output,
      error_type: failure?.type.slice(0, 256),
      error_message: failure?.message,
      trace_id:
        span !== undefined && isSpanContextValid(span)
          ? span.traceId
          : undefined,
      span_id:
        span !== undefined && isSpanContextValid(span)
          ? span.spanId
          : undefined,
      metadata,
    });
  };
}

function prepareCall(
  method: string,
  request: McpRequest,
  context: HandlerContext,
  protocol: ProtocolServer,
  registry: Readonly<Record<string, RegisteredTool>> | undefined,
  options: InstrumentMcpServerOptions,
  inject: boolean,
): PreparedCall {
  const params = request.params;
  const meta = params?._meta ?? {};
  const args = params?.arguments ?? {};
  const toolName = method === "tools/call" ? params?.name : undefined;
  const tool = toolName === undefined ? undefined : registry?.[toolName];
  const contract =
    tool === undefined ? undefined : toolContract(toolName!, tool);
  const injected = inject && contract !== undefined && !contract.open;
  const reported = injected
    ? readReportedArguments(args, contract.declared)
    : undefined;
  const headers = readHeaders(context);
  const transportSessionId =
    context.sessionId ?? headers["mcp-session-id"] ?? undefined;
  const logicalSessionId =
    attempt(() => options.sessionId?.(requestInfo(context))) ||
    reported?.conversationId;
  const mintedConversationId =
    injected &&
    !contract.declared.has("conversation_id") &&
    logicalSessionId === undefined
      ? mintConversationId()
      : undefined;
  const client = protocol.getClientVersion?.() ?? readClientInfo(meta);
  const intent = reported?.intent;
  return {
    mintedConversationId,
    request: injected
      ? {
          ...request,
          params: {
            ...params,
            arguments: withoutAgentArguments(args, contract.declared),
          },
        }
      : request,
    attributes: definedAttributes({
      "mcp.method.name": method,
      "mcp.protocol.version":
        stringOrUndefined(meta[PROTOCOL_VERSION_META_KEY]) ??
        headers["mcp-protocol-version"],
      "mcp.session.id": transportSessionId,
      "jsonrpc.request.id": requestIdOf(request, context),
      "gen_ai.operation.name":
        toolName === undefined ? undefined : "execute_tool",
      "gen_ai.tool.name": toolName,
      "gen_ai.prompt.name": method === "prompts/get" ? params?.name : undefined,
      "mcp.resource.uri":
        method === "resources/read" && params?.uri !== undefined
          ? redacted(withoutUriSecrets(params.uri), options)
          : undefined,
      "user_agent.original": headers["user-agent"],
      "judgment.mcp.server.name":
        options.serverName ?? protocol._serverInfo?.name,
      "judgment.mcp.server.version": protocol._serverInfo?.version,
      "judgment.mcp.server.build": options.serverBuild,
      "judgment.mcp.client.name": client?.name,
      "judgment.mcp.client.version": client?.version,
      "judgment.mcp.contract_hash": contract?.hash,
      "judgment.mcp.argument_keys":
        toolName === undefined
          ? undefined
          : recordedKeys(args, injected ? contract.declared : undefined),
      "judgment.mcp.conversation_id": logicalSessionId ?? mintedConversationId,
      "judgment.mcp.conversation_id_source":
        logicalSessionId !== undefined &&
        logicalSessionId !== reported?.conversationId
          ? "provided"
          : reported?.conversationId !== undefined
            ? "echoed"
            : mintedConversationId !== undefined
              ? "minted"
              : undefined,
      "judgment.mcp.intent":
        intent === undefined ? undefined : redacted(intent, options),
      "judgment.mcp.model": reported?.model,
      "judgment.mcp.sdk_version": VERSION,
    }),
  };
}

function startCallSpan(
  method: string,
  request: McpRequest,
  prepared: PreparedCall,
): { span: Span; parent: Context } {
  const target =
    method === "tools/call" || method === "prompts/get"
      ? request.params?.name
      : undefined;
  const provider = JudgmentTracerProvider.getInstance();
  const meta = request.params?._meta ?? {};
  const current = trace.deleteSpan(provider.getCurrentContext());
  const parent =
    typeof meta["traceparent"] === "string"
      ? propagator.extract(current, meta, defaultTextMapGetter)
      : current;
  const span = provider
    .getTracer(TRACER_NAME)
    .startSpan(
      target === undefined ? method : `${method} ${target}`,
      { kind: SpanKind.SERVER, attributes: prepared.attributes },
      parent,
    );
  return { span, parent };
}

function activeExporter(): McpCallExporter | undefined {
  const provider = JudgmentTracerProvider.getInstance();
  const tracer = provider.getActiveTracer();
  if (
    !tracer?._enableMonitoring ||
    !tracer.apiUrl ||
    !tracer.apiKey ||
    !tracer.organizationId ||
    !tracer.projectId
  )
    return undefined;
  let exporter = exporters.get(tracer);
  if (exporter === undefined) {
    exporter = new McpCallExporter({
      apiUrl: tracer.apiUrl,
      apiKey: tracer.apiKey,
      organizationId: tracer.organizationId,
      projectId: tracer.projectId,
    });
    exporters.set(tracer, exporter);
    provider.addBackgroundExporter(exporter);
  }
  return exporter;
}

function finish(
  span: Span,
  record: CallRecord,
  result: McpResult | undefined,
  context: HandlerContext,
  options: InstrumentMcpServerOptions,
): void {
  attempt(() => {
    const caller = identifyCaller(record, context, options);
    span.setAttributes(
      definedAttributes({
        "enduser.id": caller.userId ?? undefined,
        "judgment.customer_id": caller.customerId ?? undefined,
      }),
    );
    const signal = context.signal ?? context.mcpReq?.signal;
    if (signal?.aborted === true) {
      span.setAttribute("judgment.mcp.cancelled", "true");
    } else if (result === undefined || result.isError === true) {
      recordFailure(span, record, result, options);
    }
  });
  attempt(() => {
    span.end();
  });
}

function recordFailure(
  span: Span,
  record: CallRecord,
  result: McpResult | undefined,
  options: InstrumentMcpServerOptions,
): void {
  const failure = failureOf(record, result, options);
  span.setAttribute("error.type", failure.type);
  span.setStatus({ code: SpanStatusCode.ERROR, message: failure.message });
}

function identifyCaller(
  record: CallRecord,
  context: HandlerContext,
  options: InstrumentMcpServerOptions,
): McpCaller {
  if (record.identified !== true) {
    record.caller = {
      ...attempt(() => options.identify?.(requestInfo(context))),
      ...record.caller,
    };
    record.identified = true;
  }
  return record.caller ?? {};
}

function failureOf(
  record: CallRecord,
  result: McpResult | undefined,
  options: InstrumentMcpServerOptions,
): { type: string; message?: string } {
  if (record.failure !== undefined) return record.failure;
  const error = record.error;
  const message =
    result?.content?.[0]?.text ??
    (error instanceof Error ? error.message : undefined);
  const recorded =
    options.captureErrorMessages === false || message === undefined
      ? undefined
      : redacted(message, options)?.slice(0, MAX_ERROR_MESSAGE_LENGTH);
  record.failure = {
    type: errorType(error, result, message, options),
    message: recorded,
  };
  return record.failure;
}

/**
 * A short, low-cardinality category for why a call failed: a refusal before
 * the handler ran, else the original error's class, else a structured error
 * code the tool returned, else the generic kind of failure.
 */
function errorType(
  error: unknown,
  result: McpResult | undefined,
  message: string | undefined,
  options: InstrumentMcpServerOptions,
): string {
  const code = (error as { readonly code?: unknown } | undefined)?.code;
  const unknownTool = message === undefined ? null : UNKNOWN_TOOL.exec(message);
  if (unknownTool !== null) {
    return unknownTool[1] === "disabled" ? "tool_disabled" : "unknown_tool";
  }
  if (
    code === INVALID_PARAMS_CODE ||
    (message !== undefined && INVALID_INPUT.test(message))
  ) {
    return "invalid_input";
  }
  const errorName = error instanceof Error ? error.name : undefined;
  if (errorName !== undefined && errorName !== "Error") return errorName;
  const publicCode =
    options.captureErrorMessages === false
      ? undefined
      : publicErrorCode(message);
  const returned =
    publicCode === undefined ? undefined : redacted(publicCode, options);
  if (returned !== undefined) return returned;
  if (result !== undefined) return "tool_error";
  return typeof code === "number" ? String(code) : (errorName ?? "_OTHER");
}

/** Applies the builder's redaction. If it fails, the text isn't sent at all. */
function redacted(
  text: string,
  options: InstrumentMcpServerOptions,
): string | undefined {
  return attempt(() => options.redact?.(text) ?? text);
}

function listWithArguments(
  result: McpResult,
  registry: Readonly<Record<string, RegisteredTool>> | undefined,
  structuredTools: Set<string>,
): McpResult {
  return (
    attempt(() => ({
      ...result,
      tools: result.tools?.map((tool) => {
        const name = tool["name"];
        const registered =
          typeof name === "string" ? registry?.[name] : undefined;
        const contract =
          registered === undefined
            ? undefined
            : toolContract(name as string, registered);
        if (contract === undefined || contract.open) return tool;
        const updated = withAgentArguments(tool);
        const output = tool["outputSchema"] as
          | Readonly<Record<string, unknown>>
          | undefined;
        const extended =
          output === undefined
            ? undefined
            : withConversationOutputSchema(output);
        if (output === undefined || extended !== undefined)
          structuredTools.add(name as string);
        else structuredTools.delete(name as string);
        return extended === undefined
          ? updated
          : { ...updated, outputSchema: extended };
      }),
    })) ?? result
  );
}

function withoutInjected(
  method: string,
  request: McpRequest,
  registry: Readonly<Record<string, RegisteredTool>> | undefined,
  inject: boolean,
): McpRequest {
  const name = request.params?.name;
  const tool = name === undefined ? undefined : registry?.[name];
  if (method !== "tools/call" || !inject || tool === undefined) return request;
  const contract = toolContract(name!, tool);
  if (contract === undefined || contract.open) return request;
  return {
    ...request,
    params: {
      ...request.params,
      arguments: withoutAgentArguments(
        request.params?.arguments ?? {},
        contract.declared,
      ),
    },
  };
}

function toolContract(
  name: string,
  tool: RegisteredTool,
): ToolContract | undefined {
  const schema = tool.inputSchema;
  const cached =
    typeof schema === "object" && schema !== null
      ? contracts.get(schema)
      : undefined;
  const cacheKey = `${name}\0${tool.description ?? ""}`;
  const known = cached?.get(cacheKey);
  if (known !== undefined) return known ?? undefined;
  const shape = readSchemaShape(tool.inputSchema);
  const contract =
    shape === undefined
      ? null
      : {
          declared: new Set(shape.keys),
          hash: createHash("sha256")
            .update(name)
            .update("\0")
            .update(tool.description ?? "")
            .update("\0")
            .update(shape.fingerprint)
            .digest("hex")
            .slice(0, 16),
          open: shape.open,
        };
  if (typeof schema === "object" && schema !== null) {
    const entries = cached ?? new Map<string, ToolContract | null>();
    entries.set(cacheKey, contract);
    contracts.set(schema, entries);
  }
  return contract ?? undefined;
}

interface SchemaShape {
  readonly keys: readonly string[];
  readonly fingerprint: string;
  readonly open: boolean;
}

/** Reads a tool's input names from a Standard Schema or Zod object. */
function readSchemaShape(schema: unknown): SchemaShape | undefined {
  if (schema === undefined || schema === null)
    return { keys: [], fingerprint: "", open: false };
  const candidate = schema as {
    readonly "~standard"?: {
      readonly jsonSchema?: {
        readonly input?: (options: { target: string }) => unknown;
      };
    };
    readonly shape?: unknown;
    readonly _def?: {
      readonly shape?: unknown;
      readonly unknownKeys?: unknown;
    };
  };
  const json = attempt(() =>
    candidate["~standard"]?.jsonSchema?.input?.({ target: "draft-2020-12" }),
  ) as
    | { readonly properties?: object; readonly additionalProperties?: unknown }
    | undefined;
  if (json !== undefined) {
    return {
      keys: Object.keys(json.properties ?? {}),
      fingerprint: JSON.stringify(json),
      open: Boolean(json.additionalProperties),
    };
  }
  const definition = candidate._def?.shape;
  const shape =
    candidate.shape ??
    (typeof definition === "function" ? definition() : definition);
  if (typeof shape !== "object" || shape === null) return undefined;
  const keys = Object.keys(shape).sort();
  const fields = keys.map((key) => [key, fieldType(shape, key)]);
  return {
    keys,
    fingerprint: JSON.stringify(fields),
    open: candidate._def?.unknownKeys === "passthrough",
  };
}

/** Names a Zod field's type, so changing it changes the contract hash. */
function fieldType(shape: object, key: string): string {
  const field = (shape as Readonly<Record<string, unknown>>)[key] as
    | {
        readonly _def?: {
          readonly typeName?: unknown;
          readonly type?: unknown;
        };
      }
    | undefined;
  return String(field?._def?.typeName ?? field?._def?.type ?? "");
}

/** Drops URI parts that commonly carry credentials: user info, query and fragment. */
function withoutUriSecrets(uri: string): string {
  return uri
    .replace(/^([a-z][a-z\d+.-]*:\/\/)[^/@?#]*@/i, "$1")
    .replace(/[?#].*$/, "");
}

function readHeaders(
  context: HandlerContext,
): Readonly<Record<string, string>> {
  const web = context.http?.req?.headers;
  if (web !== undefined) return Object.fromEntries(web.entries());
  return Object.fromEntries(
    Object.entries(context.requestInfo?.headers ?? {}).flatMap(
      ([name, value]) => {
        const text = Array.isArray(value) ? value[0] : value;
        return text === undefined ? [] : [[name.toLowerCase(), text]];
      },
    ),
  );
}

function requestInfo(context: HandlerContext): McpRequestInfo {
  return {
    sessionId: context.sessionId,
    headers: readHeaders(context),
    authInfo: context.authInfo ?? context.http?.authInfo,
  };
}

function requestIdOf(
  request: McpRequest,
  context: HandlerContext,
): string | undefined {
  const id = request.id ?? context.requestId ?? context.mcpReq?.id;
  return id === undefined ? undefined : String(id);
}

function readClientInfo(
  meta: Readonly<Record<string, unknown>>,
): { readonly name?: string; readonly version?: string } | undefined {
  const info = meta[CLIENT_INFO_META_KEY];
  return typeof info === "object" && info !== null ? info : undefined;
}

/** Reads the `error` field of a structured error a tool returned as JSON text. */
function publicErrorCode(message: string | undefined): string | undefined {
  if (message?.startsWith("{") !== true) return undefined;
  const parsed = attempt(() => JSON.parse(message) as unknown);
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const code = "error" in parsed ? stringOrUndefined(parsed.error) : undefined;
  return code !== undefined && PUBLIC_ERROR_CODE.test(code) ? code : undefined;
}

/**
 * Lists a call's argument names. `declared` is set when arguments are injected, so
 * an injected name is left out unless the tool has its own argument by that name.
 */
function recordedKeys(
  args: Readonly<Record<string, unknown>>,
  declared: ReadonlySet<string> | undefined,
): string | undefined {
  const keys = Object.keys(args)
    .filter(
      (key) =>
        declared === undefined || !isAgentArgument(key) || declared.has(key),
    )
    .slice(0, MAX_RECORDED_KEYS)
    .map((key) => key.slice(0, MAX_RECORDED_KEY_LENGTH));
  return keys.length === 0 ? undefined : keys.join(",");
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function definedAttributes(
  attributes: Readonly<Record<string, string | undefined>>,
): Attributes {
  return Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== undefined),
  ) as Attributes;
}

/** Runs tracing work so that a failure in it never reaches the MCP call. */
function attempt<T>(work: () => T): T | undefined {
  try {
    return work();
  } catch {
    Logger.debug("MCP telemetry operation failed");
    return undefined;
  }
}
