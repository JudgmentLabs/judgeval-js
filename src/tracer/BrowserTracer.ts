import { resourceFromAttributes } from "@opentelemetry/resources";
import type { Sampler } from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { JudgmentApiClient } from "../internal/api";
import { Logger } from "../utils/logger";
import { VERSION } from "../version";
import { BaseTracer, type Serializer } from "./BaseTracer";

export interface BrowserTracerConfig {
  projectName: string;
  enableEvaluation?: boolean;
  enableMonitoring?: boolean;
  serializer?: Serializer;
  resourceAttributes?: Record<string, unknown>;
  sampler?: Sampler;
  initialize?: boolean;
}

interface InternalBrowserTracerConfig
  extends Required<
    Omit<BrowserTracerConfig, "resourceAttributes" | "sampler">
  > {
  resourceAttributes: Record<string, unknown>;
  sampler?: Sampler;
}

export class BrowserTracer extends BaseTracer {
  private webTracerProvider: WebTracerProvider | null = null;
  private resourceAttributes: Record<string, unknown>;
  private sampler?: Sampler;

  private constructor(
    projectName: string,
    enableEvaluation: boolean,
    apiClient: JudgmentApiClient,
    serializer: Serializer,
    resourceAttributes: Record<string, unknown>,
    sampler?: Sampler,
  ) {
    super(projectName, enableEvaluation, apiClient, serializer);
    this.resourceAttributes = resourceAttributes;
    this.sampler = sampler;
  }

  static async create(
    config: InternalBrowserTracerConfig,
    apiClient: JudgmentApiClient,
  ): Promise<BrowserTracer> {
    const tracer = new BrowserTracer(
      config.projectName,
      config.enableEvaluation,
      apiClient,
      config.serializer,
      config.resourceAttributes,
      config.sampler,
    );

    await tracer.resolveAndSetProjectId();

    if (config.initialize) {
      await tracer.initialize();
    }

    return tracer;
  }

  /* eslint-disable @typescript-eslint/require-await */
  async initialize(): Promise<void> {
    if (this.webTracerProvider !== null) {
      Logger.warn("BrowserTracer already initialized");
      return;
    }

    try {
      const attributes = {
        "service.name": this.projectName,
        "telemetry.sdk.version": VERSION,
        ...this.resourceAttributes,
      };

      const spanProcessor = this.getSpanProcessor();

      this.webTracerProvider = new WebTracerProvider({
        resource: resourceFromAttributes(attributes),
        spanProcessors: [spanProcessor],
        sampler: this.sampler,
      });

      this.webTracerProvider.register();
      Logger.info("BrowserTracer initialized successfully");
    } catch (error) {
      throw new Error(
        `Failed to initialize BrowserTracer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async shutdown(): Promise<void> {
    if (!this.webTracerProvider) {
      Logger.warn("BrowserTracer not initialized, skipping shutdown");
      return;
    }
    try {
      await this.webTracerProvider.shutdown();
      this.webTracerProvider = null;
      Logger.info("BrowserTracer shut down successfully");
    } catch (error) {
      Logger.error(`Failed to shutdown BrowserTracer: ${error}`);
    }
  }
}
