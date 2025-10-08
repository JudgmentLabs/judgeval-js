import {
  context,
  Tracer as OpenTelemetryTracer,
  Span,
  trace,
} from "@opentelemetry/api";
import { JUDGMENT_DEFAULT_GPT_MODEL } from "../env";
import { JudgmentApiClient } from "../internal/api";
import {
  ExampleEvaluationRun,
  Example as ExampleModel,
} from "../internal/api/models";
import { BaseScorer } from "../scorers/base-scorer";
import { parseFunctionArgs } from "../utils/annotate";
import { Logger } from "../utils/logger";
import { JudgmentSpanExporter, NoOpSpanExporter } from "./exporters";
import { OpenTelemetryKeys } from "./OpenTelemetryKeys";
import { TracerConfiguration } from "./TracerConfiguration";

export type Serializer = (obj: unknown) => string;
type SpanKind = string;

export type TracerInitializeOptions = {
  resourceAttributes?: Record<string, unknown>;
  [key: string]: unknown;
};

export abstract class Tracer {
  protected static instances: Map<string, Tracer> = new Map();

  public apiClient: JudgmentApiClient;
  public tracer: OpenTelemetryTracer;
  public serializer: Serializer = JSON.stringify;

  protected _initialized: boolean = false;

  private projectId: string | null = null;
  private spanExporter: JudgmentSpanExporter | NoOpSpanExporter | null = null;
  protected configuration: TracerConfiguration;

  public getConfiguration(): TracerConfiguration {
    return this.configuration;
  }

  public getProjectId(): string | null {
    return this.projectId;
  }

  public getSerializer(): Serializer {
    return this.serializer;
  }

  public constructor(configuration: TracerConfiguration) {
    this.configuration = configuration;
    this.tracer = trace.getTracer(this.configuration.tracerName);

    this.apiClient = new JudgmentApiClient(
      this.configuration.apiUrl,
      this.configuration.apiKey,
      this.configuration.organizationId,
    );

    this._initialized = false;

    if (this.configuration.initialize) {
      this.initialize({
        resourceAttributes: this.configuration.resourceAttributes,
      })
        .then(() => {
          Logger.info(
            `Successfully initialized tracer: ${this.configuration.projectName}`,
          );
        })
        .catch((error) => {
          Logger.error(
            `Failed to auto-initialize tracer: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    }
  }

  public abstract initialize(options: TracerInitializeOptions): Promise<Tracer>;

  private async resolveProjectId(): Promise<string> {
    try {
      Logger.info(
        `Resolving project ID for project: ${this.configuration.projectName}`,
      );

      const response = await this.apiClient.projectsResolve({
        project_name: this.configuration.projectName,
      });
      Logger.info(`Resolved project ID: ${response.project_id}`);
      const resolvedProjectId = response.project_id?.toString();

      if (!resolvedProjectId) {
        throw new Error(
          `Project ID not found for project: ${this.configuration.projectName}`,
        );
      }

      this.projectId = resolvedProjectId;
      Logger.info(`Successfully resolved project ID: ${this.projectId}`);

      return this.projectId;
    } catch (error) {
      throw new Error(
        `Failed to resolve project ID: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  public async getSpanExporter(): Promise<
    JudgmentSpanExporter | NoOpSpanExporter
  > {
    if (!this.spanExporter) {
      try {
        const projectId = await this.resolveProjectId();
        this.spanExporter = this.createJudgmentSpanExporter(projectId);
      } catch (error) {
        Logger.error(
          "Failed to resolve project " +
            this.configuration.projectName +
            ", please create it first at https://app.judgmentlabs.ai/org/" +
            (this.configuration.organizationId || "unknown") +
            "/projects. Skipping Judgment export.",
        );
        this.spanExporter = new NoOpSpanExporter();
      }
    }

    return this.spanExporter;
  }

  public setSpanKind(kind: SpanKind): void {
    const currentSpan = trace.getActiveSpan();
    if (!currentSpan) {
      Logger.info("No active span found, skipping setSpanKind");
      return;
    }
    if (kind !== null) {
      currentSpan.setAttribute(
        OpenTelemetryKeys.AttributeKeys.JUDGMENT_SPAN_KIND,
        kind,
      );
    }
  }

  public setAttribute(key: string, value: unknown): void {
    const currentSpan = trace.getActiveSpan();
    if (!currentSpan) {
      Logger.info("No active span found, skipping setAttribute");
      return;
    }
    currentSpan.setAttribute(key, this.serializer(value));
  }

  public setLLMSpan(): void {
    this.setSpanKind("llm");
  }

  public setToolSpan(): void {
    this.setSpanKind("tool");
  }

  public setGeneralSpan(): void {
    this.setSpanKind("span");
  }

  public setAttributes(attributes: Record<string, unknown>): void {
    if (!attributes) {
      return;
    }
    const currentSpan = trace.getActiveSpan();
    if (!currentSpan) {
      Logger.info("No active span found, skipping setAttributes");
      return;
    }
    for (const [key, value] of Object.entries(attributes)) {
      currentSpan.setAttribute(key, this.serializer(value));
    }
  }

  public setInput(input: unknown): void {
    this.setAttribute(OpenTelemetryKeys.AttributeKeys.JUDGMENT_INPUT, input);
  }

  public setOutput(output: unknown): void {
    this.setAttribute(OpenTelemetryKeys.AttributeKeys.JUDGMENT_OUTPUT, output);
  }

  public asyncEvaluate(
    scorer: BaseScorer,
    example: ExampleModel,
    model?: string,
  ): void {
    try {
      if (!this.configuration.enableEvaluation) {
        return;
      }

      const currentSpan = trace.getActiveSpan();
      if (!currentSpan) {
        Logger.info("No active span found, skipping asyncEvaluate");
        return;
      }
      if (!currentSpan.isRecording()) {
        Logger.info("Active span is not recording, skipping asyncEvaluate");
        return;
      }

      const spanContext = currentSpan.spanContext();
      const traceId = spanContext.traceId;
      const spanId = spanContext.spanId;

      Logger.info(
        `asyncEvaluate: project=${this.configuration.projectName}, traceId=${traceId}, spanId=${spanId}, scorer=${scorer.name}`,
      );

      const evaluationRun = this.createEvaluationRun(
        scorer,
        example,
        model,
        traceId,
        spanId,
      );
      this.enqueueEvaluation(evaluationRun);
    } catch (error) {
      Logger.error(
        `Failed to asyncEvaluate: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public asyncTraceEvaluate(scorer: BaseScorer, model?: string): void {
    try {
      if (!this.configuration.enableEvaluation) {
        return;
      }

      const currentSpan = trace.getActiveSpan();
      if (!currentSpan) {
        Logger.info("No active span found, skipping asyncTraceEvaluate");
        return;
      }
      if (!currentSpan.isRecording()) {
        Logger.info(
          "Active span is not recording, skipping asyncTraceEvaluate",
        );
        return;
      }

      const spanContext = currentSpan.spanContext();
      const traceId = spanContext.traceId;
      const spanId = spanContext.spanId;

      Logger.info(
        `asyncTraceEvaluate: project=${this.configuration.projectName}, traceId=${traceId}, spanId=${spanId}, scorer=${scorer.name}`,
      );

      const traceEvaluationRun = this.createTraceEvaluationRun(
        scorer,
        model,
        traceId,
        spanId,
      );
      const traceEvalJson = this.serializer(traceEvaluationRun);
      currentSpan.setAttribute(
        OpenTelemetryKeys.AttributeKeys.PENDING_TRACE_EVAL,
        traceEvalJson,
      );
    } catch (error) {
      Logger.error(
        `Failed to asyncTraceEvaluate: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private createTraceEvaluationRun(
    scorer: BaseScorer,
    model: string | undefined,
    traceId: string,
    spanId: string,
  ): Record<string, unknown> {
    const evalName = `async_trace_evaluate_${spanId || Date.now()}`;
    const modelName = model || JUDGMENT_DEFAULT_GPT_MODEL;

    const scorerConfig = scorer.getScorerConfig();

    return {
      project_name: this.configuration.projectName,
      eval_name: evalName,
      scorer: scorerConfig,
      model: modelName,
      organization_id: this.configuration.organizationId,
      trace_id: traceId,
      trace_span_id: spanId,
    };
  }

  private createJudgmentSpanExporter(projectId: string): JudgmentSpanExporter {
    const endpoint = this.configuration.apiUrl.endsWith("/")
      ? `${this.configuration.apiUrl}otel/v1/traces`
      : `${this.configuration.apiUrl}/otel/v1/traces`;

    return JudgmentSpanExporter.builder()
      .endpoint(endpoint)
      .apiKey(this.configuration.apiKey)
      .organizationId(this.configuration.organizationId)
      .projectId(projectId)
      .build();
  }

  private createEvaluationRun(
    scorer: BaseScorer,
    example: ExampleModel,
    model: string | undefined,
    traceId: string,
    spanId: string,
  ): ExampleEvaluationRun {
    const runId = `async_evaluate_${spanId || Date.now()}`;
    const modelName = model || JUDGMENT_DEFAULT_GPT_MODEL;

    const scorerConfig = scorer.getScorerConfig();

    const evaluationRun: ExampleEvaluationRun = {
      project_name: this.configuration.projectName,
      eval_name: runId,
      examples: [example],
      custom_scorers: [],
      judgment_scorers: [scorerConfig],
      model: modelName,
      trace_id: traceId,
      trace_span_id: spanId,
    };

    return evaluationRun;
  }

  private async enqueueEvaluation(
    evaluationRun: ExampleEvaluationRun,
  ): Promise<void> {
    if (!this.apiClient) {
      Logger.info("API client not available, skipping evaluation enqueue");
      return;
    }

    try {
      await this.apiClient.addToRunEvalQueueExamples(evaluationRun);
      Logger.info(`Enqueuing evaluation run: ${evaluationRun.eval_name}`);
    } catch (error) {
      Logger.error(
        `Failed to enqueue evaluation run: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private _observe<TArgs extends any[], TResult>(
    func: (...args: TArgs) => TResult,
    spanKind: SpanKind = "span",
  ): (...args: TArgs) => TResult {
    return context.bind(context.active(), (...args: TArgs): TResult => {
      const spanName = func.name || "anonymous";
      return this.tracer.startActiveSpan(spanName, (span) => {
        return this._executeWithSpan(span, func, args, spanKind);
      });
    });
  }

  private _executeWithSpan<TArgs extends any[], TResult>(
    span: Span,
    func: (...args: TArgs) => TResult,
    args: TArgs,
    spanKind: SpanKind,
  ): TResult {
    try {
      span.setAttribute(
        OpenTelemetryKeys.AttributeKeys.JUDGMENT_SPAN_KIND,
        spanKind,
      );

      try {
        const argNames = parseFunctionArgs(func);
        if (argNames.length === args.length) {
          const inputObj: Record<string, unknown> = {};
          argNames.forEach((name, index) => {
            inputObj[name] = args[index];
          });
          span.setAttribute(
            OpenTelemetryKeys.AttributeKeys.JUDGMENT_INPUT,
            this.serializer(inputObj),
          );
        }
      } catch (error) {
        Logger.warn(
          `Failed to parse function args: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const result = func(...args);

      if (result instanceof Promise) {
        return result
          .then((res) => {
            span.setAttribute(
              OpenTelemetryKeys.AttributeKeys.JUDGMENT_OUTPUT,
              this.serializer(res),
            );
            return res;
          })
          .catch((err) => {
            span.recordException(err as Error);
            throw err;
          })
          .finally(() => {
            span.end();
          }) as TResult;
      } else {
        span.setAttribute(
          OpenTelemetryKeys.AttributeKeys.JUDGMENT_OUTPUT,
          this.serializer(result),
        );
        span.end();
        return result;
      }
    } catch (err) {
      span.recordException(err as Error);
      span.end();
      throw err;
    }
  }

  public observe(
    spanKind?: SpanKind,
  ): (
    target: any,
    propertyKey: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => void;
  public observe<TArgs extends any[], TResult>(
    func: (...args: TArgs) => TResult,
    spanKind?: SpanKind,
  ): (...args: TArgs) => TResult;
  public observe<TArgs extends any[], TResult>(
    funcOrSpanKind?: ((...args: TArgs) => TResult) | SpanKind,
    spanKind?: SpanKind,
  ): any {
    try {
      if (typeof funcOrSpanKind === "function") {
        const wrapped = this._observe(funcOrSpanKind, spanKind || "span");
        Object.defineProperty(wrapped, "name", { value: funcOrSpanKind.name });
        return wrapped;
      }
      return (
        _target: any,
        _propertyKey: string | symbol,
        descriptor?: PropertyDescriptor,
      ) => {
        try {
          if (!descriptor) return;
          const originalMethod = descriptor.value;
          const wrapped = this._observe(
            originalMethod,
            funcOrSpanKind || "span",
          );
          Object.defineProperty(wrapped, "name", {
            value: originalMethod.name,
          });
          descriptor.value = wrapped;
          return descriptor;
        } catch (error) {
          Logger.error(
            `Failed to wrap method with observe: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      };
    } catch (error) {
      Logger.error(
        `Failed to observe function: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (typeof funcOrSpanKind === "function") {
        return funcOrSpanKind;
      }
      return () => {};
    }
  }

  public async shutdown(): Promise<void> {}
}
