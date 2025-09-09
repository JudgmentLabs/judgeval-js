import { context, SpanKind, trace } from "@opentelemetry/api";
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
import { JudgmentSpanExporter, NoOpSpanExporter } from "./exporters";
import { OpenTelemetryKeys } from "./OpenTelemetryKeys";
import { TracerConfiguration } from "./TracerConfiguration";

export type Serializer = (obj: unknown) => string;

export class JudgevalTracer {
  private readonly configuration: TracerConfiguration;
  private readonly apiClient: JudgmentApiClient;
  private readonly serializer: Serializer;
  private projectId: string | null = null;
  private projectIdPromise: Promise<string | null>;

  constructor(
    configuration: TracerConfiguration,
    apiClient: JudgmentApiClient,
    serializer: Serializer
  ) {
    this.configuration = configuration;
    this.apiClient = apiClient;
    this.serializer = serializer;
    this.projectIdPromise = this.resolveProjectId();
  }

  private async resolveProjectId(): Promise<string | null> {
    try {
      Logger.info(
        `Resolving project ID for project: ${this.configuration.projectName}`
      );

      const request: ResolveProjectNameRequest = {
        project_name: this.configuration.projectName,
      };

      const response = await this.apiClient.projectsResolve(request);
      this.projectId = response.project_id?.toString() || null;

      if (this.projectId) {
        Logger.info(`Successfully resolved project ID: ${this.projectId}`);
      } else {
        Logger.warn(
          `Project ID not found for project: ${this.configuration.projectName}`
        );
      }

      return this.projectId;
    } catch (error) {
      Logger.error(
        `Failed to resolve project ID for project '${
          this.configuration.projectName
        }': ${error instanceof Error ? error.message : String(error)}`
      );
      this.projectId = null;
      return null;
    }
  }

  public static builder(): TracerBuilder {
    return new TracerBuilder();
  }

  public static createDefault(projectName: string): JudgevalTracer {
    return TracerBuilder.builder()
      .configuration(TracerConfiguration.createDefault(projectName))
      .build();
  }

  public static createWithConfiguration(
    configuration: TracerConfiguration
  ): JudgevalTracer {
    return TracerBuilder.builder().configuration(configuration).build();
  }

  public async getSpanExporter(): Promise<
    JudgmentSpanExporter | NoOpSpanExporter
  > {
    const projectId = await this.projectIdPromise;
    if (projectId === null) {
      Logger.error(
        "Project not resolved; cannot create exporter, returning NoOpSpanExporter"
      );
      return new NoOpSpanExporter();
    }
    return this.createJudgmentSpanExporter(projectId);
  }

  public setSpanKind(kind: string | null): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan && kind !== null) {
      currentSpan.setAttribute(
        OpenTelemetryKeys.AttributeKeys.JUDGMENT_SPAN_KIND,
        kind
      );
    }
  }

  public setAttribute(key: string, value: unknown): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.setAttribute(key, this.serializer(value));
    }
  }

  public setAttributes(attributes: Record<string, unknown>): void {
    if (!attributes) {
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

  public setInput(input: unknown): void {
    this.setAttribute(OpenTelemetryKeys.AttributeKeys.JUDGMENT_INPUT, input);
  }

  public setOutput(output: unknown): void {
    this.setAttribute(OpenTelemetryKeys.AttributeKeys.JUDGMENT_OUTPUT, output);
  }

  private createArgumentDict<TArgs extends unknown[]>(
    fn: (...args: TArgs) => unknown,
    args: TArgs
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

  /**
   * Creates a traced version of a function that records input/output and exceptions.
   */
  public observe<TArgs extends unknown[], TReturn>(
    spanName: string,
    fn: (...args: TArgs) => TReturn,
    spanKind: "llm" | "tool" | "span" = "span",
    attributes?: Record<string, unknown>
  ): (...args: TArgs) => TReturn {
    return (...args: TArgs): TReturn => {
      const tracer = trace.getTracer("judgeval-tracer");
      const span = tracer.startSpan(spanName, {
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

  /**
   * Creates a traced version of an async function that records input/output and exceptions.
   */
  public observeAsync<TArgs extends unknown[], TReturn>(
    spanName: string,
    fn: (...args: TArgs) => Promise<TReturn>,
    spanKind: "llm" | "tool" | "span" = "span",
    attributes?: Record<string, unknown>
  ): (...args: TArgs) => Promise<TReturn> {
    return (...args: TArgs): Promise<TReturn> => {
      const tracer = trace.getTracer("judgeval-tracer");
      const span = tracer.startSpan(spanName, {
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
    E extends Record<string, any>
  >(
    scorer: APIScorer<T, P>,
    example: Example<E> & Record<KeysOf<P>, any>,
    model?: string
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
      `asyncEvaluate: project=${this.configuration.projectName}, traceId=${traceId}, spanId=${spanId}`
    );

    const evaluationRun = this.createEvaluationRun(
      scorer,
      example,
      model,
      traceId,
      spanId
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
      projectId
    );
  }

  private createEvaluationRun(
    scorer: BaseScorer,
    example: ExampleModel,
    model: string | undefined,
    traceId: string,
    spanId: string
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
    evaluationRun: ExampleEvaluationRun
  ): Promise<void> {
    try {
      await this.apiClient.addToRunEvalQueueExamples(evaluationRun);
      Logger.info(`Enqueuing evaluation run: ${evaluationRun.eval_name}`);
    } catch (error) {
      Logger.error(
        `Failed to enqueue evaluation run: ${
          error instanceof Error ? error.message : String(error)
        }`
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

  public build(): JudgevalTracer {
    if (!this.config) {
      throw new Error("Configuration is required");
    }

    const client =
      this._apiClient ||
      new JudgmentApiClient(
        this.config.apiUrl,
        this.config.apiKey,
        this.config.organizationId
      );

    return new JudgevalTracer(this.config, client, this._serializer);
  }
}
