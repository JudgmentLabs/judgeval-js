import {
  type Attributes,
  type Span,
  SpanStatusCode,
  type Tracer,
} from "@opentelemetry/api";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import type { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import { Example } from "../data";
import { JudgmentApiClient } from "../internal/api";
import { AttributeKeys } from "../judgmentAttributeKeys";
import { parseFunctionArgs } from "../utils/annotate";
import { Logger } from "../utils/logger";
import { safeStringify } from "../utils/serializer";
import { JudgmentTracerProvider } from "./JudgmentTracerProvider";
import type { JudgmentSpanExporter } from "./exporters/JudgmentSpanExporter";
import type { JudgmentSpanProcessor } from "./processors/JudgmentSpanProcessor";
import {
  CUSTOMER_ID_KEY,
  SESSION_ID_KEY,
} from "./processors/_lifecycles/contextKeys";
const TRACER_NAME = "judgeval";

export interface LLMMetadata {
  non_cached_input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  total_cost_usd?: number;
}

export interface TracerConfig {
  projectName?: string;
  apiKey?: string;
  organizationId?: string;
  apiUrl?: string;
  environment?: string;
  setActive?: boolean;
  serializer?: (value: unknown) => string;
  resourceAttributes?: Record<string, string>;
}

export type Serializer = (value: unknown) => string;

function serializeAttribute(
  value: unknown,
  serializer: Serializer,
): string | number | boolean {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value;
  return serializer(value);
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
    const tracer = BaseTracer._getProxyProvider().getActiveTracer();
    if (!tracer) return;
    tracer.getSpanProcessor().emitPartial();
  }

  // ------------------------------------------------------------------ //
  //  Static API: Span Access & Lifecycle                               //
  // ------------------------------------------------------------------ //

  static getCurrentSpan(): Span | undefined {
    const proxy = BaseTracer._getProxyProvider();
    return proxy.getCurrentSpan();
  }

  static async forceFlush(): Promise<void> {
    const proxy = BaseTracer._getProxyProvider();
    await proxy.forceFlush();
  }

  static async shutdown(): Promise<void> {
    const proxy = BaseTracer._getProxyProvider();
    await proxy.shutdown();
  }

  static registerOTELInstrumentation(instrumentor: Instrumentation): void {
    const proxy = BaseTracer._getProxyProvider();
    proxy.addInstrumentation(instrumentor);
  }

  // ------------------------------------------------------------------ //
  //  Static: Span Creation (OTEL-like signatures)                      //
  // ------------------------------------------------------------------ //

  static getOTELTracer(): Tracer {
    const proxy = BaseTracer._getProxyProvider();
    return proxy.getTracer(TRACER_NAME);
  }

  static startSpan(name: string, attributes?: Attributes): Span {
    const span = BaseTracer.getOTELTracer().startSpan(name, { attributes });
    BaseTracer._emitPartial();
    return span;
  }

  static startActiveSpan<T>(
    name: string,
    fn: (span: Span) => T,
    attributes?: Attributes,
  ): T {
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

  static span<T>(spanName: string, fn: (span: Span) => T): T {
    return BaseTracer.startActiveSpan(spanName, (span) => {
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

  static with<T>(spanName: string, fn: (span: Span) => T): T {
    return BaseTracer.span(spanName, fn);
  }

  // ------------------------------------------------------------------ //
  //  Static API: Observation Decorator                                 //
  // ------------------------------------------------------------------ //

  static observe<TArgs extends unknown[], TReturn>(
    func: (...args: TArgs) => TReturn,
    spanType?: string,
    spanName?: string,
    recordInput?: boolean,
    recordOutput?: boolean,
    disableGeneratorYieldSpan?: boolean,
  ): (...args: TArgs) => TReturn;
  static observe<TArgs extends unknown[], TReturn>(
    func?: undefined,
    spanType?: string,
    spanName?: string,
    recordInput?: boolean,
    recordOutput?: boolean,
    disableGeneratorYieldSpan?: boolean,
  ): (func: (...args: TArgs) => TReturn) => (...args: TArgs) => TReturn;
  static observe<TArgs extends unknown[], TReturn>(
    func?: (...args: TArgs) => TReturn,
    spanType = "span",
    spanName?: string,
    recordInput = true,
    recordOutput = true,
    disableGeneratorYieldSpan = false,
  ):
    | ((...args: TArgs) => TReturn)
    | ((func: (...args: TArgs) => TReturn) => (...args: TArgs) => TReturn) {
    void disableGeneratorYieldSpan;
    const proxy = BaseTracer._getProxyProvider();
    const decorator = (
      innerFunc: (...args: TArgs) => TReturn,
    ): ((...args: TArgs) => TReturn) => {
      const name = spanName ?? innerFunc.name;
      return (...args: TArgs): TReturn => {
        const otelTracer = proxy.getTracer(TRACER_NAME);
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
            const result = innerFunc(...args);

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
  //  Static: Span Kind                                                 //
  // ------------------------------------------------------------------ //

  static setSpanKind(kind: string): void {
    if (!kind) return;
    const currentSpan = BaseTracer._getProxyProvider().getCurrentSpan();
    if (currentSpan?.isRecording()) {
      currentSpan.setAttribute(AttributeKeys.JUDGMENT_SPAN_KIND, kind);
    }
  }

  static setLLMSpan(): void {
    BaseTracer.setSpanKind("llm");
  }

  static setToolSpan(): void {
    BaseTracer.setSpanKind("tool");
  }

  static setGeneralSpan(): void {
    BaseTracer.setSpanKind("span");
  }

  // ------------------------------------------------------------------ //
  //  Static: Span Attribute Operations                                 //
  // ------------------------------------------------------------------ //

  static setAttribute(key: string, value: unknown): void {
    const currentSpan = BaseTracer._getProxyProvider().getCurrentSpan();
    if (!currentSpan?.isRecording()) return;
    if (!key || value == null) return;
    currentSpan.setAttribute(
      key,
      serializeAttribute(value, BaseTracer._getSerializer()),
    );
  }

  static setAttributes(attributes: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(attributes)) {
      BaseTracer.setAttribute(key, value);
    }
  }

  static setInput(inputData: unknown): void {
    BaseTracer.setAttribute(AttributeKeys.JUDGMENT_INPUT, inputData);
  }

  static setOutput(outputData: unknown): void {
    BaseTracer.setAttribute(AttributeKeys.JUDGMENT_OUTPUT, outputData);
  }

  static recordLLMMetadata(metadata: LLMMetadata): void {
    const currentSpan = BaseTracer._getProxyProvider().getCurrentSpan();
    if (!currentSpan?.isRecording()) return;

    if (metadata.non_cached_input_tokens != null) {
      currentSpan.setAttribute(
        AttributeKeys.JUDGMENT_USAGE_NON_CACHED_INPUT_TOKENS,
        metadata.non_cached_input_tokens,
      );
    }
    if (metadata.output_tokens != null) {
      currentSpan.setAttribute(
        AttributeKeys.JUDGMENT_USAGE_OUTPUT_TOKENS,
        metadata.output_tokens,
      );
    }
    if (metadata.cache_read_input_tokens != null) {
      currentSpan.setAttribute(
        AttributeKeys.JUDGMENT_USAGE_CACHE_READ_INPUT_TOKENS,
        metadata.cache_read_input_tokens,
      );
    }
    if (metadata.cache_creation_input_tokens != null) {
      currentSpan.setAttribute(
        AttributeKeys.JUDGMENT_USAGE_CACHE_CREATION_INPUT_TOKENS,
        metadata.cache_creation_input_tokens,
      );
    }
    if (metadata.total_cost_usd != null) {
      currentSpan.setAttribute(
        AttributeKeys.JUDGMENT_USAGE_TOTAL_COST_USD,
        metadata.total_cost_usd,
      );
    }
  }

  // ------------------------------------------------------------------ //
  //  Static: Context Propagation                                       //
  // ------------------------------------------------------------------ //

  static setCustomerId(customerId: string): void {
    const proxy = BaseTracer._getProxyProvider();
    const currentSpan = proxy.getCurrentSpan();
    if (!currentSpan?.isRecording()) return;
    currentSpan.setAttribute(AttributeKeys.JUDGMENT_CUSTOMER_ID, customerId);
    const ctx = proxy.getCurrentContext().setValue(CUSTOMER_ID_KEY, customerId);
    proxy.attachContext(ctx);
  }

  static setSessionId(sessionId: string): void {
    const proxy = BaseTracer._getProxyProvider();
    const currentSpan = proxy.getCurrentSpan();
    if (!currentSpan?.isRecording()) return;
    const spanCtx = currentSpan.spanContext();
    if (!spanCtx.traceId || !(spanCtx.traceFlags & 0x01)) return;
    currentSpan.setAttribute(AttributeKeys.JUDGMENT_SESSION_ID, sessionId);
    const ctx = proxy.getCurrentContext().setValue(SESSION_ID_KEY, sessionId);
    proxy.attachContext(ctx);
  }

  // ------------------------------------------------------------------ //
  //  Static: Tags                                                      //
  // ------------------------------------------------------------------ //

  static tag(tags: string | string[]): void {
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
  }

  // ------------------------------------------------------------------ //
  //  Static API: Async Evaluation                                      //
  // ------------------------------------------------------------------ //

  static asyncEvaluate(_judge: string, _examples: Example[]): void {
    const proxy = BaseTracer._getProxyProvider();
    const tracer = proxy.getActiveTracer();
    if (!tracer?.projectId) {
      Logger.warning("asyncEvaluate: no active tracer or not configured");
      return;
    }
    const ids = BaseTracer._getCurrentTraceAndSpanId();
    if (!ids) {
      Logger.warning("asyncEvaluate: no active span");
      return;
    }
    void Promise.resolve().catch((err: unknown) => {
      Logger.error(`asyncEvaluate failed: ${String(err)}`);
    });
  }

  static asyncTraceEvaluate(_judge: string): void {
    const proxy = BaseTracer._getProxyProvider();
    const tracer = proxy.getActiveTracer();
    if (!tracer?.projectId) {
      Logger.warning("asyncTraceEvaluate: no active tracer or not configured");
      return;
    }
    const ids = BaseTracer._getCurrentTraceAndSpanId();
    if (!ids) {
      Logger.warning("asyncTraceEvaluate: no active span");
      return;
    }
    void Promise.resolve().catch((err: unknown) => {
      Logger.error(`asyncTraceEvaluate failed: ${String(err)}`);
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
