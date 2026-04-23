import {
  type Attributes,
  type Context,
  INVALID_SPAN_CONTEXT,
  type Span,
  SpanStatusCode,
  type Tracer,
} from "@opentelemetry/api";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import type {
  BasicTracerProvider,
  Sampler,
  SpanLimits,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { randomUUID } from "crypto";
import type { Anthropic } from "@anthropic-ai/sdk";
import type { OpenAI } from "openai";
import { AttributeKeys, InternalAttributeKeys } from "../JudgmentAttributeKeys";
import { wrap } from "../instrumentation";
import { JudgmentApiClient } from "../internal/api";
import type { PendingEvalPayload } from "../internal/api/models/PendingEvalPayload";
import { parseFunctionArgs } from "../utils/annotate";
import { dontThrow } from "../utils/dont-throw";
import { Logger } from "../utils/logger";
import {
  safeStringify,
  serializeAttribute,
  Serializer,
} from "../utils/serializer";
import { Maybe } from "../utils/type-helpers";
import { createBaggage, getBaggage, setBaggage } from "./baggage";
import { JudgmentTracerProvider } from "./JudgmentTracerProvider";
import { extract } from "./propagation";
import type { JudgmentSpanExporter } from "./exporters/JudgmentSpanExporter";
import type { JudgmentSpanProcessor } from "./processors/JudgmentSpanProcessor";

const TRACER_NAME = "judgeval";

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
export abstract class BaseTracer {
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

  // ------------------------------------------------------------------ //
  //  Initialization                                                    //
  // ------------------------------------------------------------------ //

  protected constructor(
    projectName: string | null,
    projectId: string | null,
    apiKey: string | null,
    organizationId: string | null,
    apiUrl: string | null,
    environment: string | null,
    serializer: Serializer,
    tracerProvider: BasicTracerProvider,
    client: JudgmentApiClient | null,
    enableMonitoring: boolean,
  ) {
    this.projectName = projectName;
    this.projectId = projectId;
    this.apiKey = apiKey;
    this.organizationId = organizationId;
    this.apiUrl = apiUrl;
    this.environment = environment;
    this.serializer = serializer;
    this._tracerProvider = tracerProvider;
    this._client = client;
    this._enableMonitoring = enableMonitoring;
  }

  /**
   * Set this tracer as the active tracer in the global provider.
   *
   * @returns `true` if activation succeeded, `false` if a root span is active.
   */
  setActive(): boolean {
    return JudgmentTracerProvider.getInstance().setActive(this);
  }

  // ------------------------------------------------------------------ //
  //  Abstract Lifecycle                                                //
  // ------------------------------------------------------------------ //

  abstract getSpanProcessor(): JudgmentSpanProcessor;
  abstract getSpanExporter(): JudgmentSpanExporter;

  // ------------------------------------------------------------------ //
  //  Internal Helpers                                                  //
  // ------------------------------------------------------------------ //

  private static _getProxyProvider(): JudgmentTracerProvider {
    return JudgmentTracerProvider.getInstance();
  }

  private static _getSerializer(): Serializer {
    const tracer = BaseTracer._getProxyProvider().getActiveTracer();
    return tracer?.serializer ?? safeStringify;
  }

  private static _getCurrentTraceAndSpanId(): [string, string] | null {
    const proxy = BaseTracer._getProxyProvider();
    const currentSpan = proxy.getCurrentSpan();
    if (!currentSpan?.isRecording()) return null;
    const ctx = currentSpan.spanContext();
    if (!ctx.traceId || !(ctx.traceFlags & 0x01)) return null;
    return [ctx.traceId, ctx.spanId];
  }

  private static _emitPartial(): void {
    dontThrow("BaseTracer._emitPartial", () => {
      const tracer = BaseTracer._getProxyProvider().getActiveTracer();
      if (!tracer) return;
      tracer.getSpanProcessor().emitPartial();
    });
  }

  // ------------------------------------------------------------------ //
  //  Static API: Span Access & Lifecycle                               //
  // ------------------------------------------------------------------ //

  /**
   * Get the currently active span.
   *
   * @returns The active span, or `undefined` if none.
   */
  static getCurrentSpan(): Span | undefined {
    const proxy = BaseTracer._getProxyProvider();
    return proxy.getCurrentSpan();
  }

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
  static async forceFlush(): Promise<void> {
    const proxy = BaseTracer._getProxyProvider();
    await proxy.forceFlush();
  }

  /**
   * Shut down the tracer and flush any pending data.
   *
   * @example
   * ```typescript
   * await Tracer.shutdown();
   * ```
   */
  static async shutdown(): Promise<void> {
    const proxy = BaseTracer._getProxyProvider();
    await proxy.shutdown();
  }

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
  static registerOTELInstrumentation(instrumentor: Instrumentation): void {
    dontThrow("BaseTracer.registerOTELInstrumentation", () => {
      const proxy = BaseTracer._getProxyProvider();
      proxy.addInstrumentation(instrumentor);
    });
  }

  /**
   * Wrap a supported LLM client to add automatic tracing.
   *
   * Supports OpenAI and Anthropic clients. The client is instrumented
   * in-place and returned.
   *
   * @param client - An LLM client instance (e.g. `new OpenAI()` or `new Anthropic()`).
   * @returns The same client instance, instrumented.
   *
   * @example
   * ```typescript
   * import OpenAI from "openai";
   * import Anthropic from "@anthropic-ai/sdk";
   *
   * const openai = Tracer.wrap(new OpenAI());
   * const anthropic = Tracer.wrap(new Anthropic());
   * ```
   */
  static wrap<T extends OpenAI | Anthropic>(client: T): T {
    return wrap(client);
  }

  // ------------------------------------------------------------------ //
  //  Static: Span Creation (OTEL-like signatures)                      //
  // ------------------------------------------------------------------ //

  /**
   * Get the underlying OpenTelemetry Tracer instance.
   *
   * @returns The OpenTelemetry `Tracer`.
   */
  static getOTELTracer(): Tracer {
    const proxy = BaseTracer._getProxyProvider();
    return proxy.getTracer(TRACER_NAME);
  }

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
  static startSpan(name: string, attributes?: Attributes): Span {
    const span = BaseTracer.getOTELTracer().startSpan(name, { attributes });
    BaseTracer._emitPartial();
    return span;
  }

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
  static startActiveSpan<T>(
    options: { name: string; attributes?: Attributes },
    fn: (span: Span) => T,
  ): T {
    const { name, attributes } = options;
    return BaseTracer.getOTELTracer().startActiveSpan(
      name,
      { attributes },
      (span) => {
        BaseTracer._emitPartial();
        const result = fn(span);
        if (result instanceof Promise) {
          return (result as Promise<unknown>).finally(() => {
            span.end();
          }) as T;
        }
        span.end();
        return result;
      },
    );
  }

  // ------------------------------------------------------------------ //
  //  Static: Span Helpers                                              //
  // ------------------------------------------------------------------ //

  /**
   * Create a named span, execute a function, and handle errors.
   *
   * Errors are recorded on the span and re-thrown.
   *
   * @param spanName - The span name.
   * @param fn - Function to execute within the span.
   * @returns The return value of `fn`.
   */
  static span<T>(spanName: string, fn: (span: Span) => T): T {
    return BaseTracer.startActiveSpan({ name: spanName }, (span) => {
      try {
        const result = fn(span);
        if (result instanceof Promise) {
          return result.catch((e: unknown) => {
            span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) });
            span.recordException(e as Error);
            throw e;
          }) as T;
        }
        return result;
      } catch (e) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) });
        span.recordException(e as Error);
        throw e;
      }
    });
  }

  /**
   * Alias for {@link span}. Create a named span and execute a function within it.
   *
   * @param spanName - The span name.
   * @param fn - Function to execute within the span.
   * @returns The return value of `fn`.
   */
  static with<T>(spanName: string, fn: (span: Span) => T): T {
    return BaseTracer.span(spanName, fn);
  }

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
  static continueTrace<T>(carrier: object, fn: (ctx: Context) => T): T {
    const proxy = BaseTracer._getProxyProvider();
    const ctx = extract(carrier);
    return proxy.withContext(ctx, () => fn(ctx));
  }

  // ------------------------------------------------------------------ //
  //  Static API: Observation Decorator                                 //
  // ------------------------------------------------------------------ //

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
  static observe<TArgs extends unknown[], TReturn>(
    func: (...args: TArgs) => TReturn,
    options?: ObserveOptions,
  ): (...args: TArgs) => TReturn;
  static observe(
    options?: ObserveOptions,
  ): <TArgs extends unknown[], TReturn>(
    func: (...args: TArgs) => TReturn,
    context?: unknown,
  ) => (...args: TArgs) => TReturn;
  static observe<TArgs extends unknown[], TReturn>(
    funcOrOptions?: ((...args: TArgs) => TReturn) | ObserveOptions,
    options?: ObserveOptions,
  ):
    | ((...args: TArgs) => TReturn)
    | ((func: (...args: TArgs) => TReturn) => (...args: TArgs) => TReturn) {
    let func: ((...args: TArgs) => TReturn) | undefined;
    if (typeof funcOrOptions === "function") {
      func = funcOrOptions;
    } else {
      options = funcOrOptions;
    }
    const {
      spanType = "span",
      spanName,
      recordInput = true,
      recordOutput = true,
      fork = false,
    } = options ?? {};
    const proxy = BaseTracer._getProxyProvider();
    const decorator = (
      innerFunc: (...args: TArgs) => TReturn,
    ): ((...args: TArgs) => TReturn) => {
      const name = spanName ?? innerFunc.name;
      return function (this: unknown, ...args: TArgs): TReturn {
        const otelTracer = proxy.getTracer(TRACER_NAME);

        const shouldFork =
          fork &&
          proxy.getActiveTracer() !== null &&
          proxy.getCurrentSpan()?.isRecording() === true;

        if (shouldFork) {
          const serializer = BaseTracer._getSerializer();

          // Invocation span — child of current trace
          const invocationSpan = otelTracer.startSpan(name);
          const invocationCtx = invocationSpan.spanContext();
          if (spanType) {
            invocationSpan.setAttribute(
              AttributeKeys.JUDGMENT_SPAN_KIND,
              spanType,
            );
          }

          // Linked-root span — root of a new trace
          const linkedRootAttrs: Attributes = {
            [AttributeKeys.JUDGMENT_LINK_SOURCE_TRACE_ID]:
              invocationCtx.traceId,
            [AttributeKeys.JUDGMENT_LINK_SOURCE_SPAN_ID]: invocationCtx.spanId,
          };
          if (spanType) {
            linkedRootAttrs[AttributeKeys.JUDGMENT_SPAN_KIND] = spanType;
          }

          const parentlessCtx = proxy.setSpan(
            proxy.getCurrentContext(),
            proxy.wrapSpanContext(INVALID_SPAN_CONTEXT),
          );
          const linkedRoot = otelTracer.startSpan(
            name,
            { attributes: linkedRootAttrs },
            parentlessCtx,
          );
          const linkedRootCtx = linkedRoot.spanContext();
          invocationSpan.setAttribute(
            AttributeKeys.JUDGMENT_LINK_TARGET_TRACE_ID,
            linkedRootCtx.traceId,
          );
          invocationSpan.setAttribute(
            AttributeKeys.JUDGMENT_LINK_TARGET_SPAN_ID,
            linkedRootCtx.spanId,
          );

          const endBoth = (): void => {
            linkedRoot.end();
            invocationSpan.end();
          };
          const recordErrorOnBoth = (e: unknown): void => {
            for (const s of [linkedRoot, invocationSpan]) {
              s.recordException(e as Error);
              s.setStatus({
                code: SpanStatusCode.ERROR,
                message: String(e),
              });
            }
          };
          const recordOutputOnBoth = (value: unknown): void => {
            const serialized = serializeAttribute(value, serializer);
            linkedRoot.setAttribute(AttributeKeys.JUDGMENT_OUTPUT, serialized);
            invocationSpan.setAttribute(
              AttributeKeys.JUDGMENT_OUTPUT,
              serialized,
            );
          };

          if (recordInput) {
            const serializedInput = serializeAttribute(
              getInputs(innerFunc, args),
              serializer,
            );
            linkedRoot.setAttribute(
              AttributeKeys.JUDGMENT_INPUT,
              serializedInput,
            );
            invocationSpan.setAttribute(
              AttributeKeys.JUDGMENT_INPUT,
              serializedInput,
            );
          }
          BaseTracer._emitPartial();

          return proxy.useSpan(linkedRoot, false, false, false, (): TReturn => {
            try {
              const result = innerFunc.call(this, ...args);
              if (result instanceof Promise) {
                return (result as Promise<unknown>)
                  .then((res) => {
                    if (recordOutput) recordOutputOnBoth(res);
                    return res as TReturn;
                  })
                  .catch((e: unknown) => {
                    recordErrorOnBoth(e);
                    throw e;
                  })
                  .finally(endBoth) as TReturn;
              }
              if (recordOutput) recordOutputOnBoth(result);
              endBoth();
              return result;
            } catch (e) {
              recordErrorOnBoth(e);
              endBoth();
              throw e;
            }
          });
        }

        return otelTracer.startActiveSpan(name, (span) => {
          if (spanType) {
            span.setAttribute(AttributeKeys.JUDGMENT_SPAN_KIND, spanType);
          }
          try {
            if (recordInput) {
              span.setAttribute(
                AttributeKeys.JUDGMENT_INPUT,
                serializeAttribute(
                  getInputs(innerFunc, args),
                  BaseTracer._getSerializer(),
                ),
              );
            }
            BaseTracer._emitPartial();
            const result = innerFunc.call(this, ...args);

            if (result instanceof Promise) {
              return (result as Promise<unknown>)
                .then((res) => {
                  if (recordOutput) {
                    span.setAttribute(
                      AttributeKeys.JUDGMENT_OUTPUT,
                      serializeAttribute(res, BaseTracer._getSerializer()),
                    );
                  }
                  return res as TReturn;
                })
                .catch((e: unknown) => {
                  span.recordException(e as Error);
                  span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: String(e),
                  });
                  throw e;
                })
                .finally(() => {
                  span.end();
                }) as TReturn;
            }

            if (recordOutput) {
              span.setAttribute(
                AttributeKeys.JUDGMENT_OUTPUT,
                serializeAttribute(result, BaseTracer._getSerializer()),
              );
            }
            span.end();
            return result;
          } catch (e) {
            span.recordException(e as Error);
            span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) });
            span.end();
            throw e;
          }
        });
      };
    };

    if (!func) return decorator;
    return decorator(func);
  }

  // ------------------------------------------------------------------ //
  //  Internal: resolve target span                                     //
  // ------------------------------------------------------------------ //

  private static _resolveSpan(span?: Span): Span | undefined {
    if (span) return span;
    return BaseTracer._getProxyProvider().getCurrentSpan();
  }

  // ------------------------------------------------------------------ //
  //  Static: Span Kind                                                 //
  // ------------------------------------------------------------------ //

  /**
   * Set the kind of a span.
   *
   * @param kind - The span kind (e.g. "llm", "tool", "span").
   * @param span - Target span. Defaults to the current active span.
   */
  static setSpanKind(kind: string): void;
  static setSpanKind(kind: string, span: Span): void;
  static setSpanKind(kind: string, span?: Span): void {
    dontThrow("BaseTracer.setSpanKind", () => {
      if (!kind) return;
      const target = BaseTracer._resolveSpan(span);
      if (target?.isRecording()) {
        target.setAttribute(AttributeKeys.JUDGMENT_SPAN_KIND, kind);
      }
    });
  }

  /**
   * Set the current span kind to "llm".
   */
  static setLLMSpan(): void {
    BaseTracer.setSpanKind("llm");
  }

  /**
   * Set the current span kind to "tool".
   */
  static setToolSpan(): void {
    BaseTracer.setSpanKind("tool");
  }

  /**
   * Set the current span kind to "span".
   */
  static setGeneralSpan(): void {
    BaseTracer.setSpanKind("span");
  }

  // ------------------------------------------------------------------ //
  //  Static: Span Attribute Operations                                 //
  // ------------------------------------------------------------------ //

  /**
   * Set a single attribute on a span.
   *
   * @param key - The attribute key.
   * @param value - The attribute value (will be serialized).
   * @param span - Target span. Defaults to the current active span.
   */
  static setAttribute(key: string, value: unknown): void;
  static setAttribute(key: string, value: unknown, span: Span): void;
  static setAttribute(key: string, value: unknown, span?: Span): void {
    dontThrow("BaseTracer.setAttribute", () => {
      const target = BaseTracer._resolveSpan(span);
      if (!target?.isRecording()) return;
      if (!key || value == null) return;
      target.setAttribute(
        key,
        serializeAttribute(value, BaseTracer._getSerializer()),
      );
    });
  }

  /**
   * Set multiple attributes on a span.
   *
   * @param attributes - Key-value pairs to set.
   * @param span - Target span. Defaults to the current active span.
   */
  static setAttributes(attributes: Record<string, unknown>): void;
  static setAttributes(attributes: Record<string, unknown>, span: Span): void;
  static setAttributes(attributes: Record<string, unknown>, span?: Span): void {
    for (const [key, value] of Object.entries(attributes)) {
      if (span) BaseTracer.setAttribute(key, value, span);
      else BaseTracer.setAttribute(key, value);
    }
  }

  /**
   * Set the input data on a span.
   *
   * @param inputData - The input data to record.
   * @param span - Target span. Defaults to the current active span.
   */
  static setInput(inputData: unknown): void;
  static setInput(inputData: unknown, span: Span): void;
  static setInput(inputData: unknown, span?: Span): void {
    if (span)
      BaseTracer.setAttribute(AttributeKeys.JUDGMENT_INPUT, inputData, span);
    else BaseTracer.setAttribute(AttributeKeys.JUDGMENT_INPUT, inputData);
  }

  /**
   * Set the output data on a span.
   *
   * @param outputData - The output data to record.
   * @param span - Target span. Defaults to the current active span.
   */
  static setOutput(outputData: unknown): void;
  static setOutput(outputData: unknown, span: Span): void;
  static setOutput(outputData: unknown, span?: Span): void {
    if (span)
      BaseTracer.setAttribute(AttributeKeys.JUDGMENT_OUTPUT, outputData, span);
    else BaseTracer.setAttribute(AttributeKeys.JUDGMENT_OUTPUT, outputData);
  }

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
  static setError(error: unknown, span?: Span): void {
    dontThrow("BaseTracer.setError", () => {
      const target = BaseTracer._resolveSpan(span);
      if (!target?.isRecording()) return;
      target.recordException(error as Error);
      target.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
    });
  }

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
  static recordLLMMetadata(metadata: LLMMetadata, span?: Span): void {
    dontThrow("BaseTracer.recordLLMMetadata", () => {
      const target = BaseTracer._resolveSpan(span);
      if (!target?.isRecording()) return;

      if (typeof metadata.model === "string") {
        target.setAttribute(
          AttributeKeys.JUDGMENT_LLM_MODEL_NAME,
          metadata.model,
        );
      }

      if (typeof metadata.provider === "string") {
        target.setAttribute(
          AttributeKeys.JUDGMENT_LLM_PROVIDER,
          metadata.provider,
        );
      }

      if (typeof metadata.non_cached_input_tokens === "number") {
        target.setAttribute(
          AttributeKeys.JUDGMENT_USAGE_NON_CACHED_INPUT_TOKENS,
          metadata.non_cached_input_tokens,
        );
      }
      if (typeof metadata.output_tokens === "number") {
        target.setAttribute(
          AttributeKeys.JUDGMENT_USAGE_OUTPUT_TOKENS,
          metadata.output_tokens,
        );
      }
      if (typeof metadata.cache_read_input_tokens === "number") {
        target.setAttribute(
          AttributeKeys.JUDGMENT_USAGE_CACHE_READ_INPUT_TOKENS,
          metadata.cache_read_input_tokens,
        );
      }
      if (typeof metadata.cache_creation_input_tokens === "number") {
        target.setAttribute(
          AttributeKeys.JUDGMENT_USAGE_CACHE_CREATION_INPUT_TOKENS,
          metadata.cache_creation_input_tokens,
        );
      }
      if (typeof metadata.total_cost_usd === "number") {
        target.setAttribute(
          AttributeKeys.JUDGMENT_USAGE_TOTAL_COST_USD,
          metadata.total_cost_usd,
        );
      }
    });
  }

  // ------------------------------------------------------------------ //
  //  Static: Context Propagation                                       //
  // ------------------------------------------------------------------ //

  /**
   * Set a key on the current span and on baggage so it propagates to all
   * child spans. Also reattaches the current context to the updated one.
   */
  private static _setPropagatingBaggageKey(key: string, value: string): void {
    dontThrow("BaseTracer._setPropagatingBaggageKey", () => {
      const proxy = BaseTracer._getProxyProvider();
      const currentSpan = proxy.getCurrentSpan();
      if (!currentSpan?.isRecording()) return;
      currentSpan.setAttribute(key, value);
      const ctx = proxy.getCurrentContext();
      const baggage = (getBaggage(ctx) ?? createBaggage()).setEntry(key, {
        value,
      });
      proxy.attachContext(setBaggage(ctx, baggage));
    });
  }

  /**
   * Set the customer ID on the current active span.
   *
   * The ID is automatically propagated to all child spans via baggage.
   * This method always targets the active span because it modifies
   * the active context's baggage for propagation.
   *
   * @param customerId - The customer identifier.
   */
  static setCustomerId(customerId: string): void {
    BaseTracer._setPropagatingBaggageKey(
      AttributeKeys.JUDGMENT_CUSTOMER_ID,
      customerId,
    );
  }

  /**
   * Set the customer user ID on the current active span.
   *
   * The ID is automatically propagated to all child spans via baggage.
   * This method always targets the active span because it modifies
   * the active context's baggage for propagation.
   *
   * @param customerUserId - The customer user identifier.
   */
  static setCustomerUserId(customerUserId: string): void {
    BaseTracer._setPropagatingBaggageKey(
      AttributeKeys.JUDGMENT_CUSTOMER_USER_ID,
      customerUserId,
    );
  }

  /**
   * Set the session ID on the current active span.
   *
   * The ID is automatically propagated to all child spans via baggage.
   * This method always targets the active span because it modifies
   * the active context's baggage for propagation.
   *
   * @param sessionId - The session identifier.
   */
  static setSessionId(sessionId: string): void {
    BaseTracer._setPropagatingBaggageKey(
      AttributeKeys.JUDGMENT_SESSION_ID,
      sessionId,
    );
  }

  // ------------------------------------------------------------------ //
  //  Static: Tags                                                      //
  // ------------------------------------------------------------------ //

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
  static tag(tags: string | string[]): void {
    dontThrow("BaseTracer.tag", () => {
      if (!tags || (Array.isArray(tags) && tags.length === 0)) return;
      const proxy = BaseTracer._getProxyProvider();
      const tracer = proxy.getActiveTracer();
      if (!tracer?.projectId || !tracer._client) return;
      const ids = BaseTracer._getCurrentTraceAndSpanId();
      if (!ids) return;
      const [traceId] = ids;
      const tagArray = Array.isArray(tags) ? tags : [tags];
      tracer._client
        .postV1projectsTracesByTraceIdTags(tracer.projectId, traceId, {
          tags: tagArray,
        })
        .catch((err: unknown) => {
          Logger.error(`tag failed: ${String(err)}`);
        });
    });
  }

  // ------------------------------------------------------------------ //
  //  Static API: Async Evaluation                                      //
  // ------------------------------------------------------------------ //

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
  static asyncEvaluate(options: AsyncEvaluateOptions, span?: Span): void {
    dontThrow("BaseTracer.asyncEvaluate", () => {
      const { judge, example } = options;
      const proxy = BaseTracer._getProxyProvider();
      const tracer = proxy.getActiveTracer();
      if (!tracer?.projectId) return;
      const target = BaseTracer._resolveSpan(span);
      if (!target?.isRecording()) return;

      const processor = tracer.getSpanProcessor();
      const ctx = target.spanContext();

      const idx = processor.stateIncr(
        ctx,
        InternalAttributeKeys.PENDING_EVALS_COUNT,
      );
      const payload: PendingEvalPayload = {
        project_id: tracer.projectId,
        eval_name: `async_evaluate_${judge}_${idx}`,
        judges: [{ name: judge }],
        examples: [
          {
            ...example,
            example_id: randomUUID(),
            created_at: new Date().toISOString(),
            trace_id: ctx.traceId,
            span_id: ctx.spanId,
          },
        ],
        is_offline: false,
        is_behavior: false,
      };
      const updated = processor.stateAppend<PendingEvalPayload>(
        ctx,
        InternalAttributeKeys.PENDING_EVALS,
        payload,
      );

      // Raw setAttribute — value is already JSON-stringified, BaseTracer.setAttribute would double-serialize.
      target.setAttribute(
        AttributeKeys.JUDGMENT_PENDING_TRACE_EVAL,
        JSON.stringify(updated),
      );
    });
  }
}

function getInputs<TArgs extends unknown[]>(
  f: (...args: TArgs) => unknown,
  args: TArgs,
): Record<string, unknown> {
  try {
    const paramNames = parseFunctionArgs(f)
      .map((param) =>
        param
          .replace(/^\.\.\./, "")
          .split("=")[0]
          .trim(),
      )
      .filter((param) => param.length > 0);
    const inputs: Record<string, unknown> = {};
    paramNames.forEach((name, index) => {
      if (index < args.length) {
        inputs[name] = args[index];
      }
    });
    return inputs;
  } catch {
    return {};
  }
}
