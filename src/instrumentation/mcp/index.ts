import { AsyncLocalStorage } from "node:async_hooks";
import { JudgmentTracerProvider } from "../../trace/JudgmentTracerProvider";
import { Logger } from "../../utils/logger";
import { VERSION } from "../../version";
import {
  SpanKind,
  SpanStatusCode,
  defaultTextMapGetter,
  trace,
  type Span,
} from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { getBaggage, setBaggage, createBaggage } from "../../trace/baggage";
import { capturePayload } from "./payload";
import {
  type ArgumentNames,
  argumentNames,
  isAgentArgument,
  canExtendSchema,
  declaredArguments,
  mintConversationId,
  readReportedArguments,
  withAgentArguments,
  withConversationIdPrompt,
  withConversationOutputSchema,
  withoutAgentArguments,
} from "./agent-arguments";

const propagator = new W3CTraceContextPropagator();
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

/** Original wire schemas, before Judgment adds telemetry arguments. */
export interface McpToolDescriptor {
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly outputSchema?: Readonly<Record<string, unknown>>;
}

/** Options for {@link instrumentMcpServer}. */
export interface InstrumentMcpServerOptions {
  /** Low-level per-tool lookup in the current request context, instead of full
   * tools/list discovery. Return original wire schemas, scoped to this caller.
   * Undefined/throwing lookups leave arguments and results unchanged.
   * High-level servers continue to use their native registry. */
  readonly resolveOriginalTool?: (
    name: string,
  ) => McpToolDescriptor | undefined | Promise<McpToolDescriptor | undefined>;
  /** Explicit name to reuse when declared, or inject when absent. Defaults to intent.
   * Existing fields are preserved; missing/non-string values are omitted.
   * Explicit names are also read with injection disabled. */
  readonly intentArgument?: string;
  /** Same behavior for the calling model. Defaults to llm_model. */
  readonly modelArgument?: string;
  /** Same behavior for conversation_id. Existing fields supply application sessions;
   * injected fields use UUIDv7 echo handles. Callback/baggage sessions take priority. */
  readonly conversationIdArgument?: string;
  /** Capture business arguments/results as-is unless redactPayload transforms them. Both default false. */
  readonly captureInput?: boolean;
  readonly captureOutput?: boolean;
  /** Receives a detached JSON snapshot. Throw or return undefined to omit it. */
  readonly redactPayload?: (
    value: unknown,
    field: "input" | "output",
  ) => unknown;
  /**
   * Authoritative application session, independent of transport. Existing
   * setSessionId baggage is also authoritative; scope it to each request,
   * not the lifetime of the server.
   */
  readonly sessionId?: (info: McpRequestInfo) => string | undefined;
  /** Defaults to the name the server advertises. */
  readonly serverName?: string;
  /** The deployed build, used to compare releases. */
  readonly serverBuild?: string;
  /**
   * Adds optional `intent`, `llm_model` and `conversation_id` arguments to each
   * tool's published schema, removes them before your handler runs, and returns
   * a conversation ID in tool results when the call has no session. Set to false
   * to leave your tools and their results exactly as they are, at the cost of
   * agent-reported intent and model, and sessions for clients that send no ID.
   * Intent is sent as-is unless transformed by redact.
   * @defaultValue true
   */
  readonly injectAgentArguments?: boolean;
  /** Disable only conversation-ID schema injection and handoff. Defaults true. */
  readonly injectConversationId?: boolean;
  /** Attaches the end user or customer once a call finishes. */
  readonly identify?: (info: McpRequestInfo) => McpCaller | undefined;
  /** Opt in to failure text, sent as-is unless transformed by redact. Default false. */
  readonly captureErrorMessages?: boolean;
  /** Rewrites failure messages and reported intent. No automatic PII scrubbing is applied. */
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
    readonly cursor?: string;
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
  readonly nextCursor?: string;
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
  readonly inputSchema?: unknown;
  readonly outputSchema?: unknown;
}

/** An `McpServer` or low-level `Server` from either supported MCP SDK. */
export type InstrumentableMcpServer = object;

interface ToolContract {
  readonly declared: ReadonlySet<string>;
  /** Accepts unknown keys, so an added argument could change what the tool receives. */
  readonly open: boolean;
}

const records = new AsyncLocalStorage<CallRecord>();
const instrumented = new WeakSet<object>();
// Updating a tool replaces its schema, invalidating its cached contract.
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

/**
 * Traces MCP tool calls using the active Judgment tracer. Explicit incoming trace
 * context is honored; otherwise a request starts a new trace.
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
  argumentNames(configuredArguments(options));
  const highLevel = server as {
    readonly server?: ProtocolServer;
    readonly _registeredTools?: Readonly<Record<string, RegisteredTool>>;
  };
  const protocol = highLevel.server ?? (server as ProtocolServer);
  if (instrumented.has(protocol)) return;
  const handlers = protocol._requestHandlers;
  if (!(handlers instanceof Map)) {
    Logger.warning(
      "Could not instrument MCP server: this MCP SDK version has no handler map. Calls still run, but aren't traced.",
    );
    return;
  }
  instrumented.add(protocol);

  const registry =
    highLevel.server === undefined ? undefined : highLevel._registeredTools;
  const inject = options.injectAgentArguments ?? true;
  const structuredTools = new Set<string>();
  const originals = new WeakMap<RequestHandler, RequestHandler>();
  const wrap = (method: string, handler: RequestHandler): RequestHandler => {
    const wrapped = traced(
      method,
      handler,
      protocol,
      registry,
      options,
      inject,
      structuredTools,
      originals,
    );
    originals.set(wrapped, handler);
    return wrapped;
  };

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
  originals: WeakMap<RequestHandler, RequestHandler>,
): RequestHandler {
  return async (request, context) => {
    if (method !== "tools/call") {
      const result = await handler(request, context);
      return method === "tools/list" && inject
        ? (attempt(() =>
            listWithArguments(result, registry, structuredTools, options),
          ) ?? result)
        : result;
    }
    // Never share caller-specific low-level contracts or output eligibility.
    const listed = protocol._requestHandlers?.get("tools/list");
    const tool =
      registry === undefined
        ? await resolveLowlevelTool(
            request,
            context,
            listed === undefined ? undefined : originals.get(listed),
            options,
          )
        : undefined;
    const callRegistry =
      registry ??
      (tool === undefined
        ? undefined
        : {
            [request.params?.name ?? ""]: tool,
          });
    const callStructuredTools =
      registry === undefined ? new Set<string>() : structuredTools;
    const prepared = attempt(() =>
      prepareCall(
        method,
        request,
        context,
        protocol,
        callRegistry,
        options,
        inject,
      ),
    );
    if (prepared === undefined) {
      const stripped =
        attempt(() =>
          withoutInjected(method, request, callRegistry, inject, options),
        ) ?? request;
      const result = await handler(stripped, context);
      return result;
    }
    const record: CallRecord = {
      error: undefined,
      caller: undefined,
    };
    const provider = JudgmentTracerProvider.getInstance();
    const started = attempt(() => startCallSpan(prepared, options));
    const run = () =>
      records.run(record, () => handler(prepared.request, context));
    try {
      const result =
        started === undefined
          ? await run()
          : await provider.withContext(started.context, run);
      if (started !== undefined)
        finishCall(started.span, record, result, context, options);
      if (
        prepared.mintedConversationId !== undefined &&
        result.structuredContent !== undefined
      ) {
        attempt(() =>
          rememberStructuredOutput(
            request.params?.name ?? "",
            callRegistry,
            callStructuredTools,
          ),
        );
      }
      const conversationId =
        attempt(() => result.isError) === true
          ? undefined
          : prepared.mintedConversationId;
      return conversationId === undefined
        ? result
        : (attempt(() =>
            withConversationIdPrompt(
              result,
              conversationId,
              callStructuredTools,
              request.params?.name ?? "",
              argumentNames(configuredArguments(options))[2],
            ),
          ) ?? result);
    } catch (error) {
      record.error ??= error;
      if (started !== undefined)
        finishCall(started.span, record, undefined, context, options);
      throw error;
    }
  };
}

async function resolveLowlevelTool(
  request: McpRequest,
  context: HandlerContext,
  list: RequestHandler | undefined,
  options: InstrumentMcpServerOptions,
): Promise<RegisteredTool | undefined> {
  const name = request.params?.name;
  if (name === undefined) return undefined;
  if (
    options.injectAgentArguments === false &&
    options.intentArgument === undefined &&
    options.modelArgument === undefined &&
    options.conversationIdArgument === undefined
  )
    return undefined;
  try {
    if (options.resolveOriginalTool !== undefined)
      return originalTool(await options.resolveOriginalTool(name));
    if (list === undefined) return undefined;
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
      // Keep caller metadata, but do not reuse the tool call's progress token.
      const { progressToken: _, ...meta } = request.params?._meta ?? {};
      const result = await list(
        {
          method: "tools/list",
          params: { cursor, _meta: meta },
        },
        context,
      );
      const tool = result.tools?.find((tool) => tool["name"] === name);
      if (tool !== undefined) return originalTool(tool);
      cursor = result.nextCursor;
      if (cursor === undefined || seen.has(cursor)) return undefined;
      seen.add(cursor);
    } while (cursor !== undefined);
    return undefined;
  } catch {
    Logger.debug("MCP tool resolution failed");
    return undefined;
  }
}

function originalTool(tool: unknown): RegisteredTool | undefined {
  if (typeof tool !== "object" || tool === null || !("inputSchema" in tool))
    return undefined;
  const schema = tool.inputSchema;
  return typeof schema === "object" && schema !== null ? tool : undefined;
}

interface PreparedCall {
  readonly request: McpRequest;
  readonly attributes: Record<string, string>;
  readonly mintedConversationId: string | undefined;
}

function startCallSpan(
  prepared: PreparedCall,
  options: InstrumentMcpServerOptions,
) {
  const provider = JudgmentTracerProvider.getInstance();
  const meta = prepared.request.params?._meta ?? {};
  // A long-lived server/HTTP span must not accidentally parent every tool call.
  const current = trace.deleteSpan(provider.getCurrentContext());
  let parent =
    typeof meta["traceparent"] === "string"
      ? propagator.extract(current, meta, defaultTextMapGetter)
      : current;
  const session = prepared.attributes["judgment.session_id"];
  if (session !== undefined) {
    parent = setBaggage(
      parent,
      (getBaggage(parent) ?? createBaggage()).setEntry("judgment.session_id", {
        value: session,
      }),
    );
  }
  const method =
    prepared.request.method ?? prepared.attributes["mcp.method.name"] ?? "mcp";
  const name = prepared.request.params?.name;
  const span = provider
    .getTracer("judgeval-mcp")
    .startSpan(
      name === undefined ? method : `${method} ${name}`,
      { kind: SpanKind.SERVER, attributes: prepared.attributes },
      parent,
    );
  if (options.captureInput === true && method === "tools/call")
    attempt(() =>
      captureSpanPayload(
        span,
        prepared.request.params?.arguments ?? {},
        "input",
        options,
      ),
    );
  return { span, context: trace.setSpan(parent, span) };
}

function captureSpanPayload(
  span: Span,
  value: unknown,
  field: "input" | "output",
  options: InstrumentMcpServerOptions,
): void {
  const payload = capturePayload(value, field, options.redactPayload);
  if (payload === undefined)
    span.setAttribute(`judgment.mcp.${field}_omitted`, "true");
  else span.setAttribute(`judgment.${field}`, JSON.stringify(payload));
}

function finishCall(
  span: Span,
  record: CallRecord,
  result: McpResult | undefined,
  context: HandlerContext,
  options: InstrumentMcpServerOptions,
): void {
  const outcome =
    attempt(() =>
      (context.signal ?? context.mcpReq?.signal)?.aborted === true
        ? "cancelled"
        : record.error !== undefined ||
            result === undefined ||
            result.isError === true
          ? "error"
          : "success",
    ) ?? "error";
  attempt(() => span.setAttribute("judgment.mcp.outcome", outcome));
  if (outcome === "error")
    attempt(() => span.setStatus({ code: SpanStatusCode.ERROR }));
  attempt(() => {
    const caller = identifyCaller(record, context, options);
    if (caller.userId)
      span.setAttribute("judgment.customer_user_id", caller.userId);
    if (caller.customerId)
      span.setAttribute("judgment.customer_id", caller.customerId);
    if (outcome === "error") {
      const failure = failureOf(record, result, options);
      span.setAttribute("error.type", failure.type);
      span.setAttribute("judgment.mcp.error_type", failure.type);
      if (failure.message !== undefined)
        span.setAttribute("judgment.mcp.error_message", failure.message);
      span.setStatus({ code: SpanStatusCode.ERROR, message: failure.message });
    }
    if (options.captureOutput === true && result !== undefined)
      captureSpanPayload(span, result, "output", options);
  });
  attempt(() => span.end());
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
  const names = configuredArguments(options);
  const contract = tool === undefined ? undefined : toolContract(tool, names);
  const injected = inject && contract !== undefined && !contract.open;
  const declared = contract?.declared ?? new Set<string>();
  const reported = readReportedArguments(args, declared, names, injected);
  const headers = readHeaders(context);
  const transportSessionId = transportSession(context, headers);
  const configuredSessionId =
    stringOrUndefined(
      attempt(() => options.sessionId?.(requestInfo(context))),
    ) ??
    stringOrUndefined(
      getBaggage(
        JudgmentTracerProvider.getInstance().getCurrentContext(),
      )?.getEntry("judgment.session_id")?.value,
    ) ??
    (names.conversationId !== undefined &&
    (declared.has(argumentNames(names)[2]) || !injected)
      ? reported.conversationId
      : undefined);
  const conversationId =
    options.injectConversationId === false
      ? undefined
      : reported?.conversationId;
  const logicalSessionId = configuredSessionId ?? conversationId;
  const sessionId = logicalSessionId ?? transportSessionId;
  const mintedConversationId =
    injected &&
    options.injectConversationId !== false &&
    !declared.has(argumentNames(names)[2]) &&
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
            arguments: withoutAgentArguments(
              args,
              declared,
              names,
              options.injectConversationId !== false,
            ),
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
      "judgment.mcp.server_name":
        options.serverName ?? protocol._serverInfo?.name ?? "mcp",
      "judgment.mcp.tool_name": toolName,
      "judgment.session_id": sessionId ?? mintedConversationId,
      "judgment.mcp.server.version": protocol._serverInfo?.version,
      "judgment.mcp.server.build": options.serverBuild,
      "judgment.mcp.client_name": client?.name,
      "judgment.mcp.client.version": client?.version,
      "judgment.mcp.argument_keys":
        toolName === undefined
          ? undefined
          : recordedKeys(
              args,
              injected ? declared : undefined,
              names,
              options.injectConversationId !== false,
            ),
      "judgment.mcp.conversation_id": logicalSessionId ?? mintedConversationId,
      "judgment.mcp.conversation_id_source":
        configuredSessionId !== undefined
          ? "provided"
          : conversationId !== undefined
            ? "echoed"
            : transportSessionId !== undefined
              ? "transport"
              : mintedConversationId !== undefined
                ? "minted"
                : undefined,
      "judgment.mcp.intent":
        intent === undefined ? undefined : redacted(intent, options),
      "judgment.llm.model": reported?.model,
      "judgment.mcp.sdk_version": VERSION,
    }),
  };
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
    options.captureErrorMessages === true && message !== undefined
      ? redacted(message, options)?.slice(0, MAX_ERROR_MESSAGE_LENGTH)
      : undefined;
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
    options.captureErrorMessages === true
      ? publicErrorCode(message)
      : undefined;
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
  const redact = options.redact;
  if (redact === undefined) return text;
  const value = attempt(() => redact(text));
  return typeof value === "string" ? value : undefined;
}

function listWithArguments(
  result: McpResult,
  registry: Readonly<Record<string, RegisteredTool>> | undefined,
  structuredTools: Set<string>,
  options: InstrumentMcpServerOptions,
): McpResult {
  return (
    attempt(() => ({
      ...result,
      tools: result.tools?.map((tool) => {
        const name = tool["name"];
        const registered =
          typeof name === "string" ? registry?.[name] : undefined;
        const names = configuredArguments(options);
        const contract =
          registered === undefined
            ? registry === undefined && originalTool(tool) !== undefined
              ? toolContract(tool, names)
              : undefined
            : toolContract(registered, names);
        if (contract === undefined || contract.open) return tool;
        const injectConversationId = options.injectConversationId !== false;
        const updated = withAgentArguments(tool, injectConversationId, names);
        if (
          !injectConversationId ||
          contract.declared.has(argumentNames(names)[2])
        )
          return updated;
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

/** Fresh server instances can receive calls without first serving tools/list. */
function rememberStructuredOutput(
  name: string,
  registry: Readonly<Record<string, RegisteredTool>> | undefined,
  structuredTools: Set<string>,
): void {
  structuredTools.delete(name);
  const tool = registry?.[name];
  if (tool === undefined) return;
  if (tool.outputSchema === undefined) {
    structuredTools.add(name);
    return;
  }
  const schema = tool.outputSchema as {
    readonly shape?: Readonly<Record<string, unknown>>;
    readonly _def?: { readonly typeName?: string };
    readonly "~standard"?: {
      readonly jsonSchema?: {
        readonly output?: (options: { target: string }) => unknown;
      };
    };
  };
  if (isJsonSchema(schema)) {
    if (withConversationOutputSchema(schema) !== undefined)
      structuredTools.add(name);
    return;
  }
  const output = schema["~standard"]?.jsonSchema?.output?.({
    target: "draft-2020-12",
  });
  // Zod 3 predates Standard Schema's JSON Schema conversion API.
  if (output === undefined && schema._def?.typeName === "ZodObject") {
    const shape = schema.shape;
    if (
      shape !== undefined &&
      Object.keys(shape).length > 0 &&
      !("_judgment" in shape)
    )
      structuredTools.add(name);
    return;
  }
  if (
    output !== undefined &&
    withConversationOutputSchema(
      output as Readonly<Record<string, unknown>>,
    ) !== undefined
  )
    structuredTools.add(name);
}

function withoutInjected(
  method: string,
  request: McpRequest,
  registry: Readonly<Record<string, RegisteredTool>> | undefined,
  inject: boolean,
  options: InstrumentMcpServerOptions,
): McpRequest {
  const name = request.params?.name;
  const tool = name === undefined ? undefined : registry?.[name];
  if (method !== "tools/call" || !inject || tool === undefined) return request;
  const names = configuredArguments(options);
  const contract = toolContract(tool, names);
  if (contract === undefined || contract.open) return request;
  return {
    ...request,
    params: {
      ...request.params,
      arguments: withoutAgentArguments(
        request.params?.arguments ?? {},
        contract.declared,
        names,
        options.injectConversationId !== false,
      ),
    },
  };
}

function configuredArguments(
  options: InstrumentMcpServerOptions,
): ArgumentNames {
  return {
    intent: options.intentArgument,
    model: options.modelArgument,
    conversationId: options.conversationIdArgument,
  };
}

function toolContract(
  tool: RegisteredTool,
  names: ArgumentNames = {},
): ToolContract | undefined {
  const schema = tool.inputSchema;
  const cacheKey = JSON.stringify(argumentNames(names));
  const cached =
    typeof schema === "object" && schema !== null && !isJsonSchema(schema)
      ? contracts.get(schema)?.get(cacheKey)
      : undefined;
  if (cached !== undefined) return cached ?? undefined;
  const shape = readSchemaShape(tool.inputSchema, names);
  const contract =
    shape === undefined
      ? null
      : {
          declared: new Set(shape.keys),
          open: shape.open,
        };
  // Raw resolver/listing schemas may be mutated in place between calls.
  if (typeof schema === "object" && schema !== null && !isJsonSchema(schema)) {
    const entries = contracts.get(schema) ?? new Map();
    entries.set(cacheKey, contract);
    contracts.set(schema, entries);
  }
  return contract ?? undefined;
}

interface SchemaShape {
  readonly keys: readonly string[];
  readonly open: boolean;
}

function isJsonSchema(schema: object): boolean {
  return "type" in schema && !("~standard" in schema);
}

/** Reads a tool's input names from a Standard Schema or Zod object. */
function readSchemaShape(
  schema: unknown,
  names: ArgumentNames,
): SchemaShape | undefined {
  if (schema === undefined || schema === null) return { keys: [], open: false };
  if (typeof schema !== "object") return undefined;
  if (isJsonSchema(schema)) {
    const json = schema as Readonly<Record<string, unknown>>;
    if (!canExtendSchema(json)) return undefined;
    return {
      keys: declaredArguments(json, names),
      open:
        json["additionalProperties"] !== false &&
        json["unevaluatedProperties"] !== false,
    };
  }
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
      readonly catchall?: {
        readonly _def?: { readonly type?: string; readonly typeName?: string };
      };
    };
  };
  const definition = candidate._def?.shape;
  const shape =
    candidate.shape ??
    (typeof definition === "function" ? definition() : definition);
  // Zod's default object parser strips extras, although its input JSON Schema
  // allows them. Read the parser's ownership policy, not that permissive schema.
  const json =
    typeof shape === "object" && shape !== null
      ? undefined
      : (attempt(() =>
          candidate["~standard"]?.jsonSchema?.input?.({
            target: "draft-2020-12",
          }),
        ) as Readonly<Record<string, unknown>> | undefined);
  if (json !== undefined) {
    if (!canExtendSchema(json)) return undefined;
    return {
      keys: declaredArguments(json, names),
      open:
        json["additionalProperties"] !== false &&
        json["unevaluatedProperties"] !== false,
    };
  }
  if (typeof shape !== "object" || shape === null) return undefined;
  const keys = Object.keys(shape).sort();
  return {
    keys,
    open:
      candidate._def?.unknownKeys === "passthrough" ||
      (candidate._def?.catchall !== undefined &&
        !["never", "ZodNever"].includes(
          String(
            candidate._def.catchall._def?.type ??
              candidate._def.catchall._def?.typeName,
          ),
        )),
  };
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
  const headers = readHeaders(context);
  return {
    sessionId: transportSession(context, headers),
    headers,
    authInfo: context.authInfo ?? context.http?.authInfo,
  };
}

function transportSession(
  context: HandlerContext,
  headers: Readonly<Record<string, string>>,
): string | undefined {
  return (
    stringOrUndefined(context.sessionId) ??
    stringOrUndefined(headers["mcp-session-id"])
  );
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
  names: ArgumentNames = {},
  injectConversationId = true,
): string | undefined {
  const keys = Object.keys(args)
    .filter(
      (key) =>
        declared === undefined ||
        !isAgentArgument(key, names, injectConversationId) ||
        declared.has(key),
    )
    .slice(0, MAX_RECORDED_KEYS)
    .map((key) => key.slice(0, MAX_RECORDED_KEY_LENGTH));
  return keys.length === 0 ? undefined : JSON.stringify(keys);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function definedAttributes(
  attributes: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(attributes).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
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
