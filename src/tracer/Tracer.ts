import { trace } from "@opentelemetry/api";
import {
  JUDGMENT_API_KEY,
  JUDGMENT_API_URL,
  JUDGMENT_DEFAULT_GPT_MODEL,
  JUDGMENT_ENABLE_EVALUATIONS,
  JUDGMENT_ENABLE_MONITORING,
  JUDGMENT_ORG_ID,
} from "../env";
import { JudgmentApiClient } from "../internal/api";
import {
  ExampleEvaluationRun,
  Example as ExampleModel,
  ResolveProjectNameRequest,
} from "../internal/api/models";
import { BaseScorer } from "../scorers/base-scorer";
import { expectApiKey, expectOrganizationId } from "../utils/guards";
import { Logger } from "../utils/logger";
import { JudgmentSpanExporter, NoOpSpanExporter } from "./exporters";
import { OpenTelemetryKeys } from "./OpenTelemetryKeys";
import { TracerConfiguration } from "./TracerConfiguration";

export type Serializer = (obj: unknown) => string;
type SpanKind = ("llm" | "tool" | "span") & {};

export class Tracer {
  private static instance: Tracer | null = null;

  public apiKey: string;
  public organizationId: string;
  public projectName: string;
  public enableMonitoring: boolean;
  public enableEvaluation: boolean;
  public apiClient: JudgmentApiClient | null = null;
  public tracer: unknown = null;
  public serializer: Serializer = JSON.stringify;

  private _initialized: boolean = false;

  private projectId: string = "";
  private configuration: TracerConfiguration | null = null;

  public getConfiguration(): TracerConfiguration | null {
    return this.configuration;
  }

  public getProjectId(): string {
    return this.projectId;
  }

  public getSerializer(): Serializer {
    return this.serializer;
  }

  private constructor(
    projectName: string,
    options: {
      apiKey?: string;
      organizationId?: string;
      enableMonitoring?: boolean;
      enableEvaluation?: boolean;
      resourceAttributes?: Record<string, unknown>;
      initialize?: boolean;
    } = {},
  ) {
    this.projectName = projectName;
    this.apiKey = expectApiKey(options.apiKey || JUDGMENT_API_KEY);
    this.organizationId = expectOrganizationId(
      options.organizationId || JUDGMENT_ORG_ID,
    );
    this.enableMonitoring =
      options.enableMonitoring ??
      JUDGMENT_ENABLE_MONITORING?.toLowerCase() === "true";
    this.enableEvaluation =
      options.enableEvaluation ??
      JUDGMENT_ENABLE_EVALUATIONS?.toLowerCase() === "true";

    if (!this._initialized) {
      this._initialized = false;

      if (options.initialize !== false) {
        // Initialize asynchronously - don't await in constructor
        this.initialize().catch((error) => {
          Logger.error(
            `Failed to initialize tracer: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      }
    }
  }

  public static getInstance(
    projectName: string,
    options: {
      apiKey?: string;
      organizationId?: string;
      enableMonitoring?: boolean;
      enableEvaluation?: boolean;
      resourceAttributes?: Record<string, unknown>;
      initialize?: boolean;
    } = {},
  ): Tracer {
    if (!Tracer.instance) {
      Tracer.instance = new Tracer(projectName, options);
    }
    return Tracer.instance;
  }

  public async initialize(): Promise<Tracer> {
    if (this._initialized) {
      return this;
    }

    // TODO: Initialize OpenTelemetry here
    // This will be implemented later

    this._initialized = true;
    return this;
  }

  private async resolveProjectId(): Promise<string> {
    if (!this.configuration || !this.apiClient) {
      throw new Error("Configuration or API client not available");
    }

    try {
      Logger.info(
        `Resolving project ID for project: ${this.configuration.projectName}`,
      );

      const request: ResolveProjectNameRequest = {
        project_name: this.configuration.projectName,
      } as const;

      const response = await this.apiClient.projectsResolve(request);
      this.projectId = response.project_id?.toString() || "";

      if (this.projectId) {
        Logger.info(`Successfully resolved project ID: ${this.projectId}`);
      } else {
        throw new Error(
          `Project ID not found for project: ${this.configuration.projectName}`,
        );
      }

      return this.projectId;
    } catch (error) {
      this.projectId = "";
      throw new Error(
        `Failed to resolve project ID: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public static builder(): TracerBuilder {
    return new TracerBuilder();
  }

  public static createDefault(projectName: string): Tracer {
    return Tracer.getInstance(projectName);
  }

  public static createWithConfiguration(
    configuration: TracerConfiguration,
  ): Tracer {
    return Tracer.builder()
      .projectName(configuration.projectName)
      .apiKey(configuration.apiKey)
      .organizationId(configuration.organizationId)
      .enableEvaluation(configuration.enableEvaluation)
      .initialize(true)
      .build();
  }

  public static getExporter(
    apiKey?: string,
    organizationId?: string,
    projectId: string = "",
  ): JudgmentSpanExporter {
    if (!projectId) {
      throw new Error("project_id is required");
    }

    const endpoint = JUDGMENT_API_URL?.endsWith("/")
      ? `${JUDGMENT_API_URL}otel/v1/traces`
      : `${JUDGMENT_API_URL}/otel/v1/traces`;

    return JudgmentSpanExporter.builder()
      .endpoint(endpoint)
      .apiKey(apiKey || JUDGMENT_API_KEY || "")
      .organizationId(organizationId || JUDGMENT_ORG_ID || "")
      .projectId(projectId)
      .build();
  }

  public async getSpanExporter(): Promise<
    JudgmentSpanExporter | NoOpSpanExporter
  > {
    if (!this._initialized) {
      throw new Error(
        "Tracer must be initialized before getting span exporter",
      );
    }

    try {
      const projectId = await this.resolveProjectId();
      return this.createJudgmentSpanExporter(projectId);
    } catch (error) {
      Logger.error(
        "Failed to resolve project " +
          this.projectName +
          ", please create it first at https://app.judgmentlabs.ai/org/" +
          (this.organizationId || "unknown") +
          "/projects. Skipping Judgment export.",
      );
      return new NoOpSpanExporter();
    }
  }

  public setSpanKind(kind: SpanKind): void {
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

  public setAttribute(key: string, value: unknown): void {
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
    if (!this._initialized || !this.configuration) {
      Logger.warn("Tracer not initialized, skipping asyncEvaluate");
      return;
    }

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
    if (!this._initialized || !this.configuration) {
      Logger.warn("Tracer not initialized, skipping asyncTraceEvaluate");
      return;
    }

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
  ): Record<string, unknown> {
    if (!this.configuration) {
      throw new Error("Configuration not available");
    }

    const evalName = `async_trace_evaluate_${spanId || Date.now()}`;
    const modelName = model || JUDGMENT_DEFAULT_GPT_MODEL;

    const scorerConfig = scorer.getConfig();

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
    if (!this.configuration) {
      throw new Error("Configuration not available");
    }

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
    if (!this.configuration) {
      throw new Error("Configuration not available");
    }

    const runId = `async_evaluate_${spanId || Date.now()}`;
    const modelName = model || JUDGMENT_DEFAULT_GPT_MODEL;

    const scorerConfig = scorer.getConfig();

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
      Logger.warn("API client not available, skipping evaluation enqueue");
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

  public observe<TArgs, TResult>(func: (...args: TArgs[]) => TResult): TResult {
    const currentSpan = trace.getActiveSpan();
    if (!currentSpan) {
      Logger.warn("No active span found, skipping observe");
      return func();
    }
    return func();
  }
}

export class TracerBuilder {
  private _projectName?: string;
  private _apiKey?: string;
  private _organizationId?: string;
  private _enableMonitoring?: boolean;
  private _enableEvaluation?: boolean;
  private _resourceAttributes?: Record<string, unknown>;
  private _initialize: boolean = true;

  public static builder(): TracerBuilder {
    return new TracerBuilder();
  }

  public projectName(projectName: string): this {
    this._projectName = projectName;
    return this;
  }

  public apiKey(apiKey: string): this {
    this._apiKey = apiKey;
    return this;
  }

  public organizationId(organizationId: string): this {
    this._organizationId = organizationId;
    return this;
  }

  public enableMonitoring(enableMonitoring: boolean): this {
    this._enableMonitoring = enableMonitoring;
    return this;
  }

  public enableEvaluation(enableEvaluation: boolean): this {
    this._enableEvaluation = enableEvaluation;
    return this;
  }

  public resourceAttributes(resourceAttributes: Record<string, unknown>): this {
    this._resourceAttributes = resourceAttributes;
    return this;
  }

  public initialize(initialize: boolean): this {
    this._initialize = initialize;
    return this;
  }

  public build(): Tracer {
    if (!this._projectName) {
      throw new Error("Project name is required");
    }

    return Tracer.getInstance(this._projectName, {
      apiKey: this._apiKey,
      organizationId: this._organizationId,
      enableMonitoring: this._enableMonitoring,
      enableEvaluation: this._enableEvaluation,
      resourceAttributes: this._resourceAttributes,
      initialize: this._initialize,
    });
  }
}
