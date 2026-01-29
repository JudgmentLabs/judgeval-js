import {
  context,
  type Context,
  type Span,
  type SpanContext,
  type SpanOptions,
  SpanStatusCode,
  trace,
  type Tracer,
} from "@opentelemetry/api";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";
import { Example } from "../data/Example";
import { JudgmentApiClient } from "../internal/api";
import type {
  ExampleEvaluationRun,
  TraceEvaluationRun,
} from "../internal/api/models";
import { AttributeKeys } from "../judgmentAttributeKeys";
import { BaseScorer } from "../scorers/BaseScorer";
import {
  isAsyncGeneratorFunction,
  isGeneratorFunction,
} from "../utils/generators";
import { Logger } from "../utils/logger";
import { resolveProjectId } from "../utils/resolveProjectId";
import { JudgmentSpanExporter, NoOpSpanExporter } from "./exporters";
import { JudgmentSpanProcessor } from "./processors/JudgmentSpanProcessor";
import { NoOpSpanProcessor } from "./processors/NoOpJudgmentSpanProcessor";

export type Serializer = (obj: unknown) => string;

export abstract class BaseTracer {
  static readonly TRACER_NAME = "judgeval";

  protected projectName: string;
  protected enableEvaluation: boolean;
  protected apiClient: JudgmentApiClient;
  protected serializer: Serializer;
  protected jsonEncoder: (obj: unknown) => string;
  protected projectId: string | null;

  protected constructor(
    projectName: string,
    enableEvaluation: boolean,
    apiClient: JudgmentApiClient,
    serializer: Serializer,
    jsonEncoder: (obj: unknown) => string = JSON.stringify,
  ) {
    this.projectName = projectName;
    this.enableEvaluation = enableEvaluation;
    this.apiClient = apiClient;
    this.serializer = serializer;
    this.jsonEncoder = jsonEncoder;
    this.projectId = null;
  }

  protected async resolveAndSetProjectId(): Promise<void> {
    try {
      this.projectId = await resolveProjectId(this.apiClient, this.projectName);
    } catch {
      Logger.error(
        `Failed to resolve project ${this.projectName}, ` +
          `please create it first at https://app.judgmentlabs.ai/org/${this.apiClient.getOrganizationId()}/projects. ` +
          "Skipping Judgment export.",
      );
      this.projectId = null;
    }
  }

  abstract initialize(): Promise<void>;
  abstract shutdown(): Promise<void>;

  getSpanExporter(): SpanExporter {
    if (this.projectId !== null) {
      return new JudgmentSpanExporter(
        this.buildEndpoint(this.apiClient.getBaseUrl()),
        this.apiClient.getApiKey(),
        this.apiClient.getOrganizationId(),
        this.projectId,
      );
    }
    Logger.error(
      "Project not resolved; cannot create exporter, returning NoOpSpanExporter",
    );
    return new NoOpSpanExporter();
  }

  getSpanProcessor(): JudgmentSpanProcessor {
    if (this.projectId !== null) {
      return new JudgmentSpanProcessor(this, this.getSpanExporter());
    }
    Logger.error(
      "Project not resolved; cannot create processor, returning NoOpSpanProcessor",
    );
    return new NoOpSpanProcessor(this);
  }

  getTracer(): Tracer {
    return trace.getTracer(BaseTracer.TRACER_NAME);
  }

  setSpanKind(kind: string): void {
    if (!kind) {
      return;
    }
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.setAttribute(AttributeKeys.JUDGMENT_SPAN_KIND, kind);
    }
  }

  setAttribute(key: string, value: unknown): void {
    if (!this.isValidKey(key)) {
      return;
    }
    if (value === null || value === undefined) {
      return;
    }
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      const serializedValue =
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
          ? value
          : this.serializer(value);
      currentSpan.setAttribute(key, serializedValue);
    }
  }

  setAttributes(attributes: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(attributes)) {
      this.setAttribute(key, value);
    }
  }

  setLLMSpan(): void {
    this.setSpanKind("llm");
  }

  setToolSpan(): void {
    this.setSpanKind("tool");
  }

  setGeneralSpan(): void {
    this.setSpanKind("span");
  }

  setInput(inputData: unknown): void {
    this.setAttribute(AttributeKeys.JUDGMENT_INPUT, inputData);
  }

  setOutput(outputData: unknown): void {
    this.setAttribute(AttributeKeys.JUDGMENT_OUTPUT, outputData);
  }

  setCustomerId(customerId: string): void {
    const currentSpan = trace.getActiveSpan();
    if (!currentSpan) {
      return;
    }
    currentSpan.setAttribute(AttributeKeys.JUDGMENT_CUSTOMER_ID, customerId);
  }

  setSessionId(sessionId: string): void {
    const currentSpan = this.getSampledSpan();
    if (!currentSpan) {
      return;
    }
    currentSpan.setAttribute(AttributeKeys.JUDGMENT_SESSION_ID, sessionId);
  }

  asyncEvaluate(scorer: BaseScorer, example: Example): void {
    this.safeExecute("evaluate scorer", () => {
      if (!this.enableEvaluation) {
        return;
      }

      const spanContext = this.getSampledSpanContext();
      if (!spanContext) {
        return;
      }

      const traceId = spanContext.traceId;
      const spanId = spanContext.spanId;

      this.logEvaluationInfo(
        "asyncEvaluate",
        traceId,
        spanId,
        scorer.getName(),
      );

      const evaluationRun = this.createEvaluationRun(
        scorer,
        example,
        traceId,
        spanId,
      );

      this.enqueueEvaluation(evaluationRun).catch((e: unknown) => {
        Logger.error(`Failed to enqueue evaluation run: ${e}`);
      });
    });
  }

  asyncTraceEvaluate(scorer: BaseScorer): void {
    this.safeExecute("evaluate trace scorer", () => {
      if (!this.enableEvaluation) {
        return;
      }

      const currentSpan = this.getSampledSpan();
      if (!currentSpan) {
        return;
      }

      const spanContext = currentSpan.spanContext();
      const traceId = spanContext.traceId;
      const spanId = spanContext.spanId;

      this.logEvaluationInfo(
        "asyncTraceEvaluate",
        traceId,
        spanId,
        scorer.getName(),
      );

      const evaluationRun = this.createTraceEvaluationRun(
        scorer,
        traceId,
        spanId,
      );
      try {
        const traceEvalJson = JSON.stringify(evaluationRun);
        currentSpan.setAttribute(
          AttributeKeys.JUDGMENT_PENDING_TRACE_EVAL,
          traceEvalJson,
        );
      } catch (e) {
        Logger.error(`Failed to serialize trace evaluation: ${e}`);
      }
    });
  }

  /**
   * Creates a new span for manual instrumentation.
   *
   * WARNING: You probably don't want this method. Use with() instead for most cases.
   *
   * This returns a span that is NOT active in the context, meaning child operations
   * will NOT automatically link to it as a parent. You must manually manage the span
   * lifecycle including calling span.end() and handling errors.
   *
   * To make the span active so child operations auto-link to it:
   * ```
   * import { context, trace } from "@opentelemetry/api";
   * const span = tracer.span("my-span");
   * context.with(trace.setSpan(context.active(), span), () => {
   *   // span is active here, child ops auto-link
   * });
   * span.end();
   * ```
   *
   * Consider using with() instead, which handles context and lifecycle automatically.
   *
   * @param spanName - The name of the span
   * @param options - Optional span configuration (attributes, links, etc)
   * @param ctx - Optional context to use as parent. Defaults to the active context
   * @returns A Span object that must be manually ended
   */
  span(spanName: string, options?: SpanOptions, ctx?: Context): Span {
    const tracer = this.getTracer();
    return tracer.startSpan(spanName, options ?? {}, ctx ?? context.active());
  }

  /**
   * Wraps a function execution in a span with automatic lifecycle management.
   *
   * Automatically handles span creation, ending, and error recording. The span is passed to
   * your callback function, allowing you to add custom attributes or access span properties.
   * The span will be ended automatically when the function completes or throws an error.
   *
   * Supports both synchronous and asynchronous functions. For async functions, the span
   * remains active until the Promise resolves or rejects.
   *
   * @param spanName - The name of the span
   * @param callableFunc - The function to execute within the span. Receives the span as a parameter
   * @param options - Optional span configuration
   * @param ctx - Optional context to use as parent. Defaults to the active context
   * @returns The return value of callableFunc (Promise if async, direct value if sync)
   */
  with<T>(
    spanName: string,
    callableFunc: (span: Span) => Promise<T>,
    options?: SpanOptions,
    ctx?: Context,
  ): Promise<T>;
  with<T>(
    spanName: string,
    callableFunc: (span: Span) => T,
    options?: SpanOptions,
    ctx?: Context,
  ): T;
  with<T>(
    spanName: string,
    callableFunc: (span: Span) => T | Promise<T>,
    options?: SpanOptions,
    ctx?: Context,
  ): T | Promise<T> {
    const tracer = this.getTracer();
    return tracer.startActiveSpan(
      spanName,
      options ?? {},
      ctx ?? context.active(),
      (span) => {
        try {
          const result = callableFunc(span);

          if (result instanceof Promise) {
            return result
              .catch((err: unknown) => {
                span.recordException(err as Error);
                span.setStatus({
                  code: SpanStatusCode.ERROR,
                  message: String(err),
                });
                throw err;
              })
              .finally(() => {
                span.end();
              });
          }

          span.end();
          return result;
        } catch (e) {
          span.setStatus({ code: SpanStatusCode.ERROR });
          span.recordException(e as Error);
          span.end();
          throw e;
        }
      },
    );
  }

  /**
   * Wraps a function to automatically trace all its invocations.
   *
   * Returns a new function that, when called, will automatically create a span, capture input
   * arguments, execute the original function, capture the output, and handle errors. The span
   * is automatically ended after the function completes.
   *
   * Supports both synchronous and asynchronous functions. Input arguments are serialized and
   * stored as span attributes, and the return value is captured as output.
   *
   * @param func - The function to wrap with automatic tracing
   * @param spanType - The type of span to create (default: "span"). Common values: "span", "llm", "tool"
   * @param spanName - Optional custom name for the span. Defaults to the function name
   * @param options - Optional span configuration
   * @param ctx - Optional context to use as parent. Defaults to the active context
   * @returns A wrapped version of the function that creates spans on each invocation
   */
  observe<TArgs extends unknown[], TResult>(
    func: (...args: TArgs) => TResult,
    spanType?: string,
    spanName?: string | null,
    options?: SpanOptions,
    ctx?: Context,
  ): (...args: TArgs) => TResult;
  observe<TArgs extends unknown[], T, TReturn, TNext>(
    func: (...args: TArgs) => AsyncGenerator<T, TReturn, TNext>,
    spanType?: string,
    spanName?: string | null,
    options?: SpanOptions,
    ctx?: Context,
  ): (...args: TArgs) => AsyncGenerator<T, TReturn, TNext>;
  observe<TArgs extends unknown[], T, TReturn, TNext>(
    func: (...args: TArgs) => Generator<T, TReturn, TNext>,
    spanType?: string,
    spanName?: string | null,
    options?: SpanOptions,
    ctx?: Context,
  ): (...args: TArgs) => Generator<T, TReturn, TNext>;
  observe<TArgs extends unknown[], TResult>(
    func: (...args: TArgs) => TResult,
    spanType = "span",
    spanName?: string | null,
    options?: SpanOptions,
    ctx?: Context,
  ): (...args: TArgs) => TResult {
    const name = spanName ?? func.name;

    if (isAsyncGeneratorFunction(func)) {
      return this.observeAsyncGenerator(
        func,
        spanType,
        name,
        options,
        ctx,
      ) as unknown as (...args: TArgs) => TResult;
    }

    if (isGeneratorFunction(func)) {
      return this.observeGenerator(
        func,
        spanType,
        name,
        options,
        ctx,
      ) as unknown as (...args: TArgs) => TResult;
    }

    const tracer = this.getTracer();

    return (...args: TArgs): TResult => {
      return tracer.startActiveSpan(
        name,
        options ?? {},
        ctx ?? context.active(),
        (span) => {
          if (spanType) {
            span.setAttribute(AttributeKeys.JUDGMENT_SPAN_KIND, spanType);
          }

          try {
            const inputData = this.formatInputs(
              func as (...args: unknown[]) => unknown,
              args as unknown[],
            );
            span.setAttribute(
              AttributeKeys.JUDGMENT_INPUT,
              this.serializer(inputData),
            );

            const result = func(...args);

            if (result instanceof Promise) {
              return result
                .then((res: TResult) => {
                  span.setAttribute(
                    AttributeKeys.JUDGMENT_OUTPUT,
                    this.serializer(res),
                  );
                  return res;
                })
                .catch((err: unknown) => {
                  span.recordException(err as Error);
                  span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: String(err),
                  });
                  throw err;
                })
                .finally(() => {
                  span.end();
                }) as TResult;
            }

            span.setAttribute(
              AttributeKeys.JUDGMENT_OUTPUT,
              this.serializer(result),
            );
            span.end();
            return result;
          } catch (e) {
            span.recordException(e as Error);
            span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) });
            span.end();
            throw e;
          }
        },
      );
    };
  }

  private observeAsyncGenerator<TArgs extends unknown[], T, TReturn, TNext>(
    func: (...args: TArgs) => AsyncGenerator<T, TReturn, TNext>,
    spanType: string,
    name: string,
    options?: SpanOptions,
    ctx?: Context,
  ): (...args: TArgs) => AsyncGenerator<T, TReturn, TNext> {
    return (...args: TArgs): AsyncGenerator<T, TReturn, TNext> => {
      const parentContext = ctx ?? context.active();
      const span = this.getTracer().startSpan(
        name,
        options ?? {},
        parentContext,
      );
      const spanContext = trace.setSpan(parentContext, span);

      if (spanType) {
        span.setAttribute(AttributeKeys.JUDGMENT_SPAN_KIND, spanType);
      }

      const inputData = this.formatInputs(
        func as (...args: unknown[]) => unknown,
        args as unknown[],
      );
      span.setAttribute(
        AttributeKeys.JUDGMENT_INPUT,
        this.serializer(inputData),
      );

      const generator = context.with(spanContext, () => func(...args));

      const wrappedNext = context.bind(
        spanContext,
        async (
          ...nextArgs: [] | [TNext]
        ): Promise<IteratorResult<T, TReturn>> => {
          try {
            const result = await generator.next(...nextArgs);
            if (result.done) {
              span.setAttribute(
                AttributeKeys.JUDGMENT_OUTPUT,
                this.serializer(result.value),
              );
              span.end();
            }
            return result;
          } catch (e) {
            span.recordException(e as Error);
            span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) });
            span.end();
            throw e;
          }
        },
      );

      const wrappedReturn = context.bind(
        spanContext,
        async (
          value: TReturn | PromiseLike<TReturn>,
        ): Promise<IteratorResult<T, TReturn>> => {
          try {
            const result = await generator.return(value);
            span.setAttribute(
              AttributeKeys.JUDGMENT_OUTPUT,
              this.serializer(result.value),
            );
            span.end();
            return result;
          } catch (e) {
            span.recordException(e as Error);
            span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) });
            span.end();
            throw e;
          }
        },
      );

      const wrappedThrow = context.bind(
        spanContext,
        async (e: unknown): Promise<IteratorResult<T, TReturn>> => {
          try {
            return await generator.throw(e);
          } catch (err) {
            span.recordException(err as Error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: String(err),
            });
            span.end();
            throw err;
          }
        },
      );

      return {
        next: wrappedNext,
        return: wrappedReturn,
        throw: wrappedThrow,
        [Symbol.asyncIterator]() {
          return this;
        },
      } as AsyncGenerator<T, TReturn, TNext>;
    };
  }

  private observeGenerator<TArgs extends unknown[], T, TReturn, TNext>(
    func: (...args: TArgs) => Generator<T, TReturn, TNext>,
    spanType: string,
    name: string,
    options?: SpanOptions,
    ctx?: Context,
  ): (...args: TArgs) => Generator<T, TReturn, TNext> {
    return (...args: TArgs): Generator<T, TReturn, TNext> => {
      const parentContext = ctx ?? context.active();
      const span = this.getTracer().startSpan(
        name,
        options ?? {},
        parentContext,
      );
      const spanContext = trace.setSpan(parentContext, span);

      if (spanType) {
        span.setAttribute(AttributeKeys.JUDGMENT_SPAN_KIND, spanType);
      }

      const inputData = this.formatInputs(
        func as (...args: unknown[]) => unknown,
        args as unknown[],
      );
      span.setAttribute(
        AttributeKeys.JUDGMENT_INPUT,
        this.serializer(inputData),
      );

      const generator = context.with(spanContext, () => func(...args));

      const wrappedNext = context.bind(
        spanContext,
        (...nextArgs: [] | [TNext]): IteratorResult<T, TReturn> => {
          try {
            const result = generator.next(...nextArgs);
            if (result.done) {
              span.setAttribute(
                AttributeKeys.JUDGMENT_OUTPUT,
                this.serializer(result.value),
              );
              span.end();
            }
            return result;
          } catch (e) {
            span.recordException(e as Error);
            span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) });
            span.end();
            throw e;
          }
        },
      );

      const wrappedReturn = context.bind(
        spanContext,
        (value: TReturn): IteratorResult<T, TReturn> => {
          try {
            const result = generator.return(value);
            span.setAttribute(
              AttributeKeys.JUDGMENT_OUTPUT,
              this.serializer(result.value),
            );
            span.end();
            return result;
          } catch (e) {
            span.recordException(e as Error);
            span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) });
            span.end();
            throw e;
          }
        },
      );

      const wrappedThrow = context.bind(
        spanContext,
        (e: unknown): IteratorResult<T, TReturn> => {
          try {
            return generator.throw(e);
          } catch (err) {
            span.recordException(err as Error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: String(err),
            });
            span.end();
            throw err;
          }
        },
      );

      return {
        next: wrappedNext,
        return: wrappedReturn,
        throw: wrappedThrow,
        [Symbol.iterator]() {
          return this;
        },
      } as Generator<T, TReturn, TNext>;
    };
  }

  private buildEndpoint(baseUrl: string): string {
    return baseUrl.endsWith("/")
      ? baseUrl + "otel/v1/traces"
      : baseUrl + "/otel/v1/traces";
  }

  private generateRunId(prefix: string, spanId?: string | null): string {
    return prefix + (spanId ?? Date.now().toString());
  }

  private createEvaluationRun(
    scorer: BaseScorer,
    example: Example,
    traceId: string,
    spanId: string,
  ): ExampleEvaluationRun {
    const runId = this.generateRunId("async_evaluate_", spanId);

    return {
      project_name: this.projectName,
      eval_name: runId,
      trace_id: traceId,
      trace_span_id: spanId,
      examples: [example.toModel()],
      judgment_scorers: [scorer.getScorerConfig()],
      custom_scorers: [],
    };
  }

  private createTraceEvaluationRun(
    scorer: BaseScorer,
    traceId: string,
    spanId: string,
  ): TraceEvaluationRun {
    const evalName = this.generateRunId("async_trace_evaluate_", spanId);

    return {
      project_name: this.projectName,
      eval_name: evalName,
      trace_and_span_ids: [[traceId, spanId]],
      judgment_scorers: [scorer.getScorerConfig()],
      custom_scorers: [],
      is_offline: false,
    };
  }

  private async enqueueEvaluation(
    evaluationRun: ExampleEvaluationRun,
  ): Promise<void> {
    try {
      await this.apiClient.addToRunEvalQueueExamples(evaluationRun);
    } catch (e) {
      Logger.error(`Failed to enqueue evaluation run: ${e}`);
    }
  }

  private getSampledSpanContext(): SpanContext | null {
    const currentSpan = trace.getActiveSpan();
    if (!currentSpan) {
      return null;
    }
    const spanContext = currentSpan.spanContext();
    if (!spanContext.traceFlags || !(spanContext.traceFlags & 0x01)) {
      return null;
    }
    return spanContext;
  }

  private getSampledSpan(): Span | null {
    const currentSpan = trace.getActiveSpan();
    if (!currentSpan) {
      return null;
    }
    const spanContext = currentSpan.spanContext();
    if (!spanContext.traceFlags || !(spanContext.traceFlags & 0x01)) {
      return null;
    }
    return currentSpan;
  }

  private logEvaluationInfo(
    method: string,
    traceId: string,
    spanId: string,
    scorerName: string,
  ): void {
    Logger.info(
      `${method}: project=${this.projectName}, traceId=${traceId}, spanId=${spanId}, scorer=${scorerName}`,
    );
  }

  private safeExecute(operation: string, action: () => void): void {
    try {
      action();
    } catch (e) {
      Logger.error(`Failed to ${operation}: ${e}`);
    }
  }

  private isValidKey(key: string): boolean {
    return key.length > 0;
  }

  private formatInputs(
    f: (...args: unknown[]) => unknown,
    args: unknown[],
  ): Record<string, unknown> {
    try {
      const funcStr = f.toString();
      const match = /\(([^)]*)\)/.exec(funcStr);
      const paramNames = match
        ? match[1]
            .split(",")
            .map((param) => param.trim().split("=")[0].trim())
            .filter((param) => param.length > 0)
        : [];

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
}
