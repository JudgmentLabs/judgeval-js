import { trace } from "@opentelemetry/api";
import { JUDGMENT_DEFAULT_GPT_MODEL } from "../env";
import { JudgmentApiClient } from "../internal/api";
import {
  ExampleEvaluationRun,
  Example as ExampleModel,
  ResolveProjectNameRequest,
} from "../internal/api/models";
import { BaseScorer } from "../scorers/base-scorer";
import { Logger } from "../utils/logger";
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

  public getConfiguration(): TracerConfiguration {
    return this.configuration;
  }

  public getProjectId(): string | null {
    return this.projectId;
  }

  public getSerializer(): Serializer {
    return this.serializer;
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
    const currentSpan = trace.getActiveSpan();
    if (!currentSpan) {
      Logger.warn("No active span found, skipping setSpanKind");
      return;
    }
    if (kind !== null) {
      currentSpan.setAttribute(
        OpenTelemetryKeys.AttributeKeys.JUDGMENT_SPAN_KIND,
        kind,
      );
    }
  }

  public setAttribute(key: string, value: unknown, type?: any): void {
    const currentSpan = trace.getActiveSpan();
    if (!currentSpan) {
      Logger.warn("No active span found, skipping setAttribute");
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
      Logger.warn("No active span found, skipping setAttributes");
      return;
    }
    for (const [key, value] of Object.entries(attributes)) {
      currentSpan.setAttribute(key, this.serializer(value));
    }
  }

  public setInput(input: unknown, type?: any): void {
    this.setAttribute(OpenTelemetryKeys.AttributeKeys.JUDGMENT_INPUT, input);
  }

  public setOutput(output: unknown, type?: any): void {
    this.setAttribute(OpenTelemetryKeys.AttributeKeys.JUDGMENT_OUTPUT, output);
  }

  public asyncEvaluate(
    scorer: BaseScorer,
    example: ExampleModel,
    model?: string,
  ): void {
    if (!this.configuration.enableEvaluation) {
      return;
    }

    const currentSpan = trace.getActiveSpan();
    if (!currentSpan) {
      Logger.warn("No active span found, skipping asyncEvaluate");
      return;
    }
    if (!currentSpan.isRecording()) {
      Logger.warn("Active span is not recording, skipping asyncEvaluate");
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
  }

  public asyncTraceEvaluate(scorer: BaseScorer, model?: string): void {
    if (!this.configuration.enableEvaluation) {
      return;
    }

    const currentSpan = trace.getActiveSpan();
    if (!currentSpan) {
      Logger.warn("No active span found, skipping asyncTraceEvaluate");
      return;
    }
    if (!currentSpan.isRecording()) {
      Logger.warn("Active span is not recording, skipping asyncTraceEvaluate");
      return;
    }

    const spanContext = currentSpan.spanContext();
    const traceId = spanContext.traceId;
    const spanId = spanContext.spanId;

    Logger.info(
      `asyncTraceEvaluate: project=${this.configuration.projectName}, traceId=${traceId}, spanId=${spanId}, scorer=${scorer.name}`,
    );

    try {
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
        `Failed to serialize trace evaluation: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private createTraceEvaluationRun(
    scorer: BaseScorer,
    model: string | undefined,
    traceId: string,
    spanId: string,
  ): any {
    const evalName = `async_trace_evaluate_${spanId || Date.now()}`;
    const modelName = model || JUDGMENT_DEFAULT_GPT_MODEL;

    const scorerConfig = scorer.toTransport();

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

    const scorerConfig = scorer.toTransport();

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
