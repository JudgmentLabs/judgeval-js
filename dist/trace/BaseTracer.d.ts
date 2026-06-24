import { type Attributes, type Context, type Span, type Tracer } from "@opentelemetry/api";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import type { BasicTracerProvider, Sampler, SpanLimits, SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { JudgmentApiClient } from "../internal/api";
import { Serializer } from "../utils/serializer";
import { Maybe } from "../utils/type-helpers";
import type { JudgmentSpanExporter } from "./exporters/JudgmentSpanExporter";
import type { JudgmentSpanProcessor } from "./processors/JudgmentSpanProcessor";
/**
 * Metadata about an LLM call to record on a span.
 */
export interface LLMMetadata {
    /** Model name (e.g. "gpt-4o"). */
    model?: Maybe<string>;
    /** Provider name (e.g. "openai"). */
    provider?: Maybe<string>;
    /** Number of non-cached input tokens. */
    non_cached_input_tokens?: Maybe<number>;
    /** Number of output tokens. */
    output_tokens?: Maybe<number>;
    /** Number of cache-read input tokens. */
    cache_read_input_tokens?: Maybe<number>;
    /** Number of cache-creation input tokens. */
    cache_creation_input_tokens?: Maybe<number>;
    /** Total cost in USD. */
    total_cost_usd?: Maybe<number>;
}
/**
 * Options for {@link BaseTracer.observe}.
 */
export interface ObserveOptions {
    /** The span kind (e.g. `"llm"`, `"tool"`, `"span"`). Defaults to `"span"`. */
    spanType?: string;
    /** Custom span name. Defaults to the wrapped function's name. */
    spanName?: string;
    /** Whether to record function inputs as a span attribute. Defaults to `true`. */
    recordInput?: boolean;
    /** Whether to record function outputs as a span attribute. Defaults to `true`. */
    recordOutput?: boolean;
    /**
     * If `true`, run the function in a fresh linked trace instead of as a
     * child of the current trace, when an active parent span exists.
     * Defaults to `false`.
     */
    fork?: boolean;
}
/**
 * Options for {@link BaseTracer.asyncEvaluate}.
 */
export interface AsyncEvaluateOptions {
    /**
     * Name of the hosted judge/scorer (e.g. `"faithfulness"`,
     * `"answer_relevancy"`).
     */
    judge: string;
    /**
     * Optional dict with evaluation data. Keys like `input`, `actual_output`,
     * `expected_output`, and `retrieval_context` are commonly used.
     */
    example?: Record<string, unknown>;
}
/**
 * Configuration options for initializing a Tracer.
 *
 * Credentials are resolved in order: explicit arguments first, then
 * environment variables.
 */
export interface TracerConfig {
    /** Your Judgment project name. Required for span export. */
    projectName?: string;
    /** Judgment API key. Defaults to `JUDGMENT_API_KEY` env var. */
    apiKey?: string;
    /** Judgment organization ID. Defaults to `JUDGMENT_ORG_ID` env var. */
    organizationId?: string;
    /** Judgment API URL. Defaults to `JUDGMENT_API_URL` env var. */
    apiUrl?: string;
    /** Deployment environment name (e.g. "production"). */
    environment?: string;
    /** Whether to automatically set this tracer as active. Defaults to `true`. */
    setActive?: boolean;
    /** Custom serialization function for span attribute values. */
    serializer?: (value: unknown) => string;
    /** Additional OpenTelemetry resource attributes. */
    resourceAttributes?: Record<string, string>;
    /** Custom OpenTelemetry sampler. Defaults to the SDK's default. */
    sampler?: Sampler;
    /** Custom OpenTelemetry span limits (attribute/event/link caps). */
    spanLimits?: SpanLimits;
    /** Additional span processors to register alongside Judgment's own processor. */
    spanProcessors?: SpanProcessor[];
}
/**
 * Abstract base for all Judgment tracers.
 *
 * Provides the core tracing surface: span creation, attribute recording,
 * the `observe` decorator, context propagation for customer/session IDs,
 * tagging, and async evaluation dispatch.
 * Concrete subclasses supply the OTel TracerProvider, exporter, and
 * processor wiring.
 */
export declare abstract class BaseTracer {
    projectName: string | null;
    projectId: string | null;
    apiKey: string | null;
    organizationId: string | null;
    apiUrl: string | null;
    environment: string | null;
    serializer: Serializer;
    _tracerProvider: BasicTracerProvider;
    _client: JudgmentApiClient | null;
    _enableMonitoring: boolean;
    readonly supportsLiveInstrumentation: boolean;
    protected constructor(projectName: string | null, projectId: string | null, apiKey: string | null, organizationId: string | null, apiUrl: string | null, environment: string | null, serializer: Serializer, tracerProvider: BasicTracerProvider, client: JudgmentApiClient | null, enableMonitoring: boolean);
    /**
     * Set this tracer as the active tracer in the global provider.
     *
     * @returns `true` if activation succeeded, `false` if a root span is active.
     */
    setActive(): boolean;
    abstract getSpanProcessor(): JudgmentSpanProcessor;
    abstract getSpanExporter(): JudgmentSpanExporter;
    private static _getProxyProvider;
    private static _getSerializer;
    private static _getCurrentTraceAndSpanId;
    private static _emitPartial;
    /**
     * Get the currently active span.
     *
     * @returns The active span, or `undefined` if none.
     */
    static getCurrentSpan(): Span | undefined;
    /**
     * Flush all pending spans to the export endpoint.
     *
     * Call this before your process exits to ensure all spans are sent.
     *
     * @example
     * ```typescript
     * await Tracer.forceFlush();
     * ```
     */
    static forceFlush(): Promise<void>;
    /**
     * Shut down the tracer and flush any pending data.
     *
     * @example
     * ```typescript
     * await Tracer.shutdown();
     * ```
     */
    static shutdown(): Promise<void>;
    /**
     * Register an OpenTelemetry instrumentation to capture spans automatically.
     *
     * @param instrumentor - The OpenTelemetry instrumentation to register.
     *
     * @example
     * ```typescript
     * import { OpenAIInstrumentation } from "@opentelemetry/instrumentation-openai";
     * Tracer.registerOTELInstrumentation(new OpenAIInstrumentation());
     * ```
     */
    static registerOTELInstrumentation(instrumentor: Instrumentation): void;
    /**
     * Wrap a supported LLM client to add automatic tracing.
     *
     * Currently supports OpenAI clients. The client is instrumented
     * in-place and returned.
     *
     * @param client - An LLM client instance (e.g. `new OpenAI()`).
     * @returns The same client instance, instrumented.
     *
     * @example
     * ```typescript
     * import OpenAI from "openai";
     *
     * const client = Tracer.wrap(new OpenAI());
     * ```
     */
    static wrap<T>(client: T): T;
    /**
     * Get the underlying OpenTelemetry Tracer instance.
     *
     * @returns The OpenTelemetry `Tracer`.
     */
    static getOTELTracer(): Tracer;
    /**
     * Start a new span without setting it as active.
     *
     * **Most users should prefer {@link observe} or {@link with}**, which
     * handle activation, error recording, and span ending automatically.
     * Use this only when you need low-level control over the span lifecycle.
     *
     * @param name - The span name.
     * @param attributes - Optional span attributes.
     * @returns The created span.
     */
    static startSpan(name: string, attributes?: Attributes): Span;
    /**
     * Start a new active span and run a function within it.
     *
     * The span is automatically ended when the function completes.
     *
     * **Most users should prefer {@link observe} or {@link with}**, which
     * additionally record inputs/outputs and capture errors automatically.
     * Use this only when you need low-level control over the span lifecycle.
     *
     * @param options - Span options. `name` is required; `attributes` is optional.
     * @param fn - Function to execute within the span context.
     * @returns The return value of `fn`.
     *
     * @example
     * ```typescript
     * Tracer.startActiveSpan({ name: "fetch-user" }, (span) => {
     *   // ...
     * });
     * ```
     */
    static startActiveSpan<T>(options: {
        name: string;
        attributes?: Attributes;
    }, fn: (span: Span) => T): T;
    /**
     * Create a named span, execute a function, and handle errors.
     *
     * Errors are recorded on the span and re-thrown.
     *
     * @param spanName - The span name.
     * @param fn - Function to execute within the span.
     * @returns The return value of `fn`.
     */
    static span<T>(spanName: string, fn: (span: Span) => T): T;
    /**
     * Alias for {@link span}. Create a named span and execute a function within it.
     *
     * @param spanName - The span name.
     * @param fn - Function to execute within the span.
     * @returns The return value of `fn`.
     */
    static with<T>(spanName: string, fn: (span: Span) => T): T;
    /**
     * Continue a distributed trace from an upstream service.
     *
     * Extracts W3C trace context and baggage from `carrier` and installs
     * it as the active context for the duration of `fn`. Any span started
     * inside — including `@Tracer.observe`-wrapped functions and
     * `Tracer.with` blocks — becomes a child of the upstream parent,
     * stitching your service into the caller's trace.
     *
     * Use this at the entry point of an inbound request (HTTP handler,
     * message queue consumer, RPC dispatcher, etc.) to join a trace
     * started by the upstream caller. If the carrier contains no trace
     * context, `fn` still runs normally with a fresh context.
     *
     * @param carrier - A mapping containing propagation headers. Typically
     *   `req.headers` from Node's `http`/Express/Fastify, but any dict-shaped
     *   object with lowercase keys works (queue attributes, Lambda event
     *   headers, RPC metadata, etc.).
     * @param fn - Function to run inside the extracted context. Receives
     *   the extracted {@link Context} as its argument; most callers ignore
     *   it. Sync or async.
     * @returns The return value of `fn`.
     *
     * @example
     * ```typescript
     * import { Tracer } from "judgeval";
     *
     * const handle = Tracer.observe(async (payload: unknown) => {
     *   // ... your agent logic ...
     * });
     *
     * // Express / Node http handler:
     * app.post("/run", async (req, res) => {
     *   await Tracer.continueTrace(req.headers, async () => {
     *     const result = await handle(req.body);
     *     res.json(result);
     *   });
     * });
     * ```
     *
     * Propagating in the opposite direction (outbound):
     *
     * @example
     * ```typescript
     * import { propagation } from "judgeval";
     *
     * const headers: Record<string, string> = {};
     * propagation.inject(headers);
     * await fetch(downstreamUrl, { headers, method: "POST", body });
     * ```
     */
    static continueTrace<T>(carrier: object, fn: (ctx: Context) => T): T;
    /**
     * Wrap a function to automatically create spans and record inputs/outputs.
     *
     * Can be called with a function to wrap it directly, or with just options
     * to get a decorator (e.g. for TC39 decorator syntax).
     *
     * @param func - The function to wrap. Omit to get a decorator.
     * @param options - Optional observation options.
     * @returns The wrapped function, or a decorator if `func` is omitted.
     *
     * @example
     * ```typescript
     * // Direct wrapping
     * const traced = Tracer.observe(
     *   async (query: string) => search(query),
     *   { spanType: "tool" },
     * );
     *
     * // Decorator form
     * class Agent {
     *   \@Tracer.observe({ spanType: "llm" })
     *   async chat(input: string) { ... }
     * }
     *
     * // Fork into a linked trace
     * const delegate = Tracer.observe(runSubsystem, {
     *   spanType: "agent",
     *   fork: true,
     * });
     * ```
     */
    static observe<TArgs extends unknown[], TReturn>(func: (...args: TArgs) => TReturn, options?: ObserveOptions): (...args: TArgs) => TReturn;
    static observe(options?: ObserveOptions): <TArgs extends unknown[], TReturn>(func: (...args: TArgs) => TReturn, context?: unknown) => (...args: TArgs) => TReturn;
    private static _resolveSpan;
    /**
     * Set the kind of a span.
     *
     * @param kind - The span kind (e.g. "llm", "tool", "span").
     * @param span - Target span. Defaults to the current active span.
     */
    static setSpanKind(kind: string): void;
    static setSpanKind(kind: string, span: Span): void;
    /**
     * Set the current span kind to "llm".
     */
    static setLLMSpan(): void;
    /**
     * Set the current span kind to "tool".
     */
    static setToolSpan(): void;
    /**
     * Set the current span kind to "span".
     */
    static setGeneralSpan(): void;
    /**
     * Set a single attribute on a span.
     *
     * @param key - The attribute key.
     * @param value - The attribute value (will be serialized).
     * @param span - Target span. Defaults to the current active span.
     */
    static setAttribute(key: string, value: unknown): void;
    static setAttribute(key: string, value: unknown, span: Span): void;
    /**
     * Set multiple attributes on a span.
     *
     * @param attributes - Key-value pairs to set.
     * @param span - Target span. Defaults to the current active span.
     */
    static setAttributes(attributes: Record<string, unknown>): void;
    static setAttributes(attributes: Record<string, unknown>, span: Span): void;
    /**
     * Set the input data on a span.
     *
     * @param inputData - The input data to record.
     * @param span - Target span. Defaults to the current active span.
     */
    static setInput(inputData: unknown): void;
    static setInput(inputData: unknown, span: Span): void;
    /**
     * Set the output data on a span.
     *
     * @param outputData - The output data to record.
     * @param span - Target span. Defaults to the current active span.
     */
    static setOutput(outputData: unknown): void;
    static setOutput(outputData: unknown, span: Span): void;
    /**
     * Record an error on a span.
     *
     * Sets the span status to ERROR and records the exception.
     *
     * @param error - The error to record.
     * @param span - Target span. Defaults to the current active span.
     */
    static setError(error: unknown): void;
    static setError(error: unknown, span: Span): void;
    /**
     * Record LLM usage metadata on a span.
     *
     * @param metadata - LLM metadata including model, provider, and token counts.
     * @param span - Target span. Defaults to the current active span.
     *
     * @example
     * ```typescript
     * Tracer.recordLLMMetadata({
     *   model: "gpt-4o",
     *   provider: "openai",
     *   output_tokens: 150,
     * });
     * ```
     */
    static recordLLMMetadata(metadata: LLMMetadata): void;
    static recordLLMMetadata(metadata: LLMMetadata, span: Span): void;
    /**
     * Set a key on the current span and on baggage so it propagates to all
     * child spans. Also reattaches the current context to the updated one.
     */
    private static _setPropagatingBaggageKey;
    /**
     * Set the customer ID on the current active span.
     *
     * The ID is automatically propagated to all child spans via baggage.
     * This method always targets the active span because it modifies
     * the active context's baggage for propagation.
     *
     * @param customerId - The customer identifier.
     */
    static setCustomerId(customerId: string): void;
    /**
     * Set the customer user ID on the current active span.
     *
     * The ID is automatically propagated to all child spans via baggage.
     * This method always targets the active span because it modifies
     * the active context's baggage for propagation.
     *
     * @param customerUserId - The customer user identifier.
     */
    static setCustomerUserId(customerUserId: string): void;
    /**
     * Set the session ID on the current active span.
     *
     * The ID is automatically propagated to all child spans via baggage.
     * This method always targets the active span because it modifies
     * the active context's baggage for propagation.
     *
     * @param sessionId - The session identifier.
     */
    static setSessionId(sessionId: string): void;
    /**
     * Add tags to the current trace.
     *
     * @param tags - A single tag string or an array of tag strings.
     *
     * @example
     * ```typescript
     * Tracer.tag("production");
     * Tracer.tag(["important", "customer-facing"]);
     * ```
     */
    static tag(tags: string | string[]): void;
    /**
     * Trigger an asynchronous server-side evaluation on a span.
     *
     * The evaluation is queued and processed server-side by the Judgment
     * platform after the span ends. Use this to score live traffic
     * without blocking your application.
     *
     * @param options - Evaluation options. `judge` is required; `example`
     *   is optional evaluation data.
     * @param span - Target span. Defaults to the current active span.
     *
     * @example
     * ```typescript
     * Tracer.asyncEvaluate({
     *   judge: "answer_relevancy",
     *   example: {
     *     input: "What is AI?",
     *     actual_output: response,
     *   },
     * });
     * ```
     */
    static asyncEvaluate(options: AsyncEvaluateOptions): void;
    static asyncEvaluate(options: AsyncEvaluateOptions, span: Span): void;
}
//# sourceMappingURL=BaseTracer.d.ts.map