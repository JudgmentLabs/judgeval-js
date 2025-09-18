import { context, SpanKind, trace } from "@opentelemetry/api";
import { Resource } from "@opentelemetry/resources";
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  Tracer as OTELTracer,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { Example } from "../data/example";
import { JUDGMENT_DEFAULT_GPT_MODEL } from "../env";
import { JudgmentApiClient } from "../internal/api";
import {
  BaseScorer,
  ExampleEvaluationRun,
  Example as ExampleModel,
  ResolveProjectNameRequest,
} from "../internal/api/models";
import { APIScorer, APIScorerType } from "../scorers/api-scorer";
import { parseFunctionArgs } from "../utils/annotate";
import { Logger } from "../utils/logger";
import { KeysOf } from "../utils/types";
import { VERSION } from "../version";
import { JudgmentSpanExporter, NoOpSpanExporter } from "./exporters";
import { OpenTelemetryKeys } from "./OpenTelemetryKeys";
import { TracerConfiguration } from "./TracerConfiguration";

export type Serializer = (obj: unknown) => string;

export class Tracer {
  private readonly configuration: TracerConfiguration;
  private readonly apiClient: JudgmentApiClient;
  private readonly serializer: Serializer;
  private projectId: string | null = null;
  private projectIdPromise: Promise<string | null>;

  private provider?: BasicTracerProvider;
  private tracer?: OTELTracer;
  private judgmentProcessor?: SpanProcessor;

  public getTracer(): OTELTracer | undefined {
    return this.tracer;
  }

  public getConfiguration(): TracerConfiguration {
    return this.configuration;
  }

  public getProjectId(): string | null {
    return this.projectId;
  }

  public getSerializer(): Serializer {
    return this.serializer;
  }

  /**
   * Registers the OpenTelemetry provider and creates the tracer.
   * This method is optional and should only be called if you want to use
   * OpenTelemetry tracing functionality. If you have existing OpenTelemetry
   * setup, you may not need to call this method.
   */
  public registerOtel(): void {
    if (this.provider) {
      Logger.warn("OpenTelemetry provider is already registered");
      return;
    }

    this.provider = new BasicTracerProvider({
      resource: new Resource({
        "service.name": this.configuration.projectName,
      }),
    });

    this.provider.register();
    this.tracer = this.provider.getTracer(
      this.configuration.tracerName,
      VERSION,
    );

    Logger.info(
      `OpenTelemetry provider registered with tracer name: ${this.configuration.tracerName}`,
    );

    // Setup exporter if projectId is already resolved
    if (this.projectId) {
      this.setupExporter();
    }
  }

  constructor(
    configuration: TracerConfiguration,
    apiClient: JudgmentApiClient,
    serializer: Serializer,
  ) {
    this.configuration = configuration;
    this.apiClient = apiClient;
    this.serializer = serializer;
    this.projectIdPromise = this.resolveProjectId();
  }

  private async resolveProjectId(): Promise<string | null> {
    try {
      Logger.info(
        `Resolving project ID for project: ${this.configuration.projectName}`,
      );

      const request: ResolveProjectNameRequest = {
        project_name: this.configuration.projectName,
      } as const;

      const response = await this.apiClient.projectsResolve(request);
      this.projectId = response.project_id?.toString() || null;

      if (this.projectId) {
        Logger.info(`Successfully resolved project ID: ${this.projectId}`);
        // Only setup exporter if provider is registered
        if (this.provider) {
          this.setupExporter();
        }
      } else {
        Logger.warn(
          `Project ID not found for project: ${this.configuration.projectName}`,
        );
      }

      return this.projectId;
    } catch (error) {
      this.projectId = null;
      return null;
    }
  }

  private setupExporter(): void {
    if (!this.projectId || !this.provider) return;

    const exporter = this.createJudgmentSpanExporter(this.projectId);
    this.judgmentProcessor = new BatchSpanProcessor(exporter, {
      maxQueueSize: 2 ** 18,
      maxExportBatchSize: 512,
      exportTimeoutMillis: 30000,
      scheduledDelayMillis: 5000,
    });

    this.provider.addSpanProcessor(this.judgmentProcessor);
    Logger.info("Judgment exporter setup completed");
  }

  public static builder(): TracerBuilder {
    return new TracerBuilder();
  }

  public static createDefault(projectName: string): Tracer {
    return TracerBuilder.builder()
      .configuration(TracerConfiguration.createDefault(projectName))
      .build();
  }

  public static createWithConfiguration(
    configuration: TracerConfiguration,
  ): Tracer {
    return TracerBuilder.builder().configuration(configuration).build();
  }

  public async getSpanExporter(): Promise<
    JudgmentSpanExporter | NoOpSpanExporter
  > {
    const projectId = await this.projectIdPromise;
    if (!projectId) {
      Logger.error(
        "Failed to resolve project " +
          this.configuration.projectName +
          ", please create it first at https://app.judgmentlabs.ai/org/" +
          this.configuration.organizationId +
          "/projects. Skipping Judgment export.",
      );
      return new NoOpSpanExporter();
    }
    return this.createJudgmentSpanExporter(projectId);
  }

  public setSpanKind(kind: string | null): void {
    if (!this.tracer) return;

    const currentSpan = trace.getActiveSpan();
    if (currentSpan && kind !== null) {
      currentSpan.setAttribute(
        OpenTelemetryKeys.AttributeKeys.JUDGMENT_SPAN_KIND,
        kind,
      );
    }
  }

  public setAttribute(key: string, value: unknown): void {
    if (!this.tracer) return;

    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.setAttribute(key, this.serializer(value));
    }
  }

  public setAttributes(attributes: Record<string, unknown>): void {
    if (!attributes || !this.tracer) {
      return;
    }
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      for (const [key, value] of Object.entries(attributes)) {
        currentSpan.setAttribute(key, this.serializer(value));
      }
    }
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

  public async forceFlush(): Promise<void> {
    if (!this.provider) {
      Logger.warn("No OpenTelemetry provider registered, skipping force flush");
      return;
    }

    try {
      await this.provider.forceFlush();
      Logger.info("Tracer force flush completed");
    } catch (error) {
      Logger.error(
        `Error during force flush: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public async shutdown(): Promise<void> {
    if (!this.provider) {
      Logger.warn("No OpenTelemetry provider registered, skipping shutdown");
      return;
    }

    try {
      await this.provider.shutdown();
      Logger.info("Tracer shutdown completed");
    } catch (error) {
      Logger.error(
        `Error during shutdown: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public setInput(input: unknown): void {
    if (!this.tracer) return;
    this.setAttribute(OpenTelemetryKeys.AttributeKeys.JUDGMENT_INPUT, input);
  }

  public setOutput(output: unknown): void {
    if (!this.tracer) return;
    this.setAttribute(OpenTelemetryKeys.AttributeKeys.JUDGMENT_OUTPUT, output);
  }

  private createArgumentDict<TArgs extends unknown[]>(
    fn: (...args: TArgs) => unknown,
    args: TArgs,
  ): Record<string, unknown> {
    try {
      const argNames = parseFunctionArgs(fn);
      const argumentDict: Record<string, unknown> = {};

      for (let i = 0; i < args.length; i++) {
        if (i < argNames.length) {
          argumentDict[argNames[i]] = args[i];
        } else {
          argumentDict[`arguments[${i}]`] = args[i];
        }
      }

      return argumentDict;
    } catch (error) {
      const fallbackDict: Record<string, unknown> = {};
      for (let i = 0; i < args.length; i++) {
        fallbackDict[`arguments[${i}]`] = args[i];
      }
      return fallbackDict;
    }
  }

  public observe<TArgs extends unknown[], TReturn>(
    spanName: string,
    fn: (...args: TArgs) => TReturn,
    spanKind: ("llm" | "tool" | "span") & {} = "span",
    attributes?: Record<string, unknown>,
  ): (...args: TArgs) => TReturn {
    return (...args: TArgs): TReturn => {
      if (!this.tracer) {
        return fn(...args);
      }

      const span = this.tracer.startSpan(spanName, {
        kind: SpanKind.INTERNAL,
        attributes: {
          [OpenTelemetryKeys.AttributeKeys.JUDGMENT_SPAN_KIND]: spanKind,
          ...attributes,
        },
      });

      return context.with(trace.setSpan(context.active(), span), () => {
        try {
          const argumentDict = this.createArgumentDict(fn, args);
          this.setInput(argumentDict);
          const result = fn(...args);
          this.setOutput(result);
          return result;
        } catch (error) {
          span.recordException(error as Error);
          throw error;
        } finally {
          span.end();
        }
      });
    };
  }

  public observeAsync<TArgs extends unknown[], TReturn>(
    spanName: string,
    fn: (...args: TArgs) => Promise<TReturn>,
    spanKind: ("llm" | "tool" | "span") & {} = "span",
    attributes?: Record<string, unknown>,
  ): (...args: TArgs) => Promise<TReturn> {
    return (...args: TArgs): Promise<TReturn> => {
      if (!this.tracer) {
        return fn(...args);
      }

      const span = this.tracer.startSpan(spanName, {
        kind: SpanKind.INTERNAL,
        attributes: {
          [OpenTelemetryKeys.AttributeKeys.JUDGMENT_SPAN_KIND]: spanKind,
          ...attributes,
        },
      });

      return context.with(trace.setSpan(context.active(), span), async () => {
        try {
          const argumentDict = this.createArgumentDict(fn, args);
          this.setInput(argumentDict);
          const result = await fn(...args);
          this.setOutput(result);
          return result;
        } catch (error) {
          span.recordException(error as Error);
          throw error;
        } finally {
          span.end();
        }
      });
    };
  }

  public asyncEvaluate<
    T extends APIScorerType,
    P extends readonly string[],
    E extends Record<string, any>,
  >(
    scorer: APIScorer<T, P>,
    example: Example<E> & Record<KeysOf<P>, any>,
    model?: string,
  ): void {
    if (!this.configuration.enableEvaluation) {
      return;
    }

    const currentSpan = trace.getActiveSpan();
    if (!currentSpan || !currentSpan.isRecording()) {
      return;
    }

    const spanContext = currentSpan.spanContext();
    const traceId = spanContext.traceId;
    const spanId = spanContext.spanId;

    Logger.info(
      `asyncEvaluate: project=${this.configuration.projectName}, traceId=${traceId}, spanId=${spanId}`,
    );

    const evaluationRun = this.createEvaluationRun(
      scorer,
      example,
      model,
      traceId,
      spanId,
    );
    this.enqueueEvaluation(evaluationRun);
  }

  private createJudgmentSpanExporter(projectId: string): JudgmentSpanExporter {
    const endpoint = this.configuration.apiUrl.endsWith("/")
      ? `${this.configuration.apiUrl}otel/v1/traces`
      : `${this.configuration.apiUrl}/otel/v1/traces`;

    return new JudgmentSpanExporter(
      endpoint,
      this.configuration.apiKey,
      this.configuration.organizationId,
      projectId,
    );
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

    const evaluationRun: ExampleEvaluationRun = {
      project_name: this.configuration.projectName,
      eval_name: runId,
      examples: [example],
      custom_scorers: [],
      judgment_scorers: [scorer],
      model: modelName,
      trace_id: traceId,
      trace_span_id: spanId,
    };

    return evaluationRun;
  }

  private async enqueueEvaluation(
    evaluationRun: ExampleEvaluationRun,
  ): Promise<void> {
    try {
      await this.apiClient.addToRunEvalQueueExamples(evaluationRun);
      Logger.info(`Enqueuing evaluation run: ${evaluationRun.eval_name}`);
    } catch (error) {
      Logger.error(
        `Failed to enqueue evaluation run: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export class TracerBuilder {
  private config?: TracerConfiguration;
  private _apiClient?: JudgmentApiClient;
  private _serializer: Serializer = JSON.stringify;

  public static builder(): TracerBuilder {
    return new TracerBuilder();
  }

  public configuration(configuration: TracerConfiguration): this {
    this.config = configuration;
    return this;
  }

  public apiClient(apiClient: JudgmentApiClient): this {
    this._apiClient = apiClient;
    return this;
  }

  public serializer(serializer: Serializer): this {
    this._serializer = serializer;
    return this;
  }

  public build(): Tracer {
    if (!this.config) {
      throw new Error("Configuration is required");
    }

    const client =
      this._apiClient ||
      new JudgmentApiClient(
        this.config.apiUrl,
        this.config.apiKey,
        this.config.organizationId,
      );

    return new Tracer(this.config, client, this._serializer);
  }
}
