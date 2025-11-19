import { context } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  registerInstrumentations,
  type Instrumentation,
} from "@opentelemetry/instrumentation";
import {
  defaultResource,
  resourceFromAttributes,
} from "@opentelemetry/resources";
import { type Sampler } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { JudgmentApiClient } from "../internal/api";
import { ResourceKeys } from "../judgmentAttributeKeys";
import { Logger } from "../utils/logger";
import { VERSION } from "../version";
import { BaseTracer, type Serializer } from "./BaseTracer";
import {
  JudgmentNodeTracerProvider,
  filterTracerParams,
} from "./JudgmentNodeTracerProvider";

export interface NodeTracerConfig {
  projectName: string;
  enableEvaluation?: boolean;
  enableMonitoring?: boolean;
  serializer?: Serializer;
  resourceAttributes?: Record<string, unknown>;
  instrumentations?: Instrumentation[];
  sampler?: Sampler;
  initialize?: boolean;
  filterTracer?: (params: filterTracerParams) => boolean;
}

interface InternalNodeTracerConfig
  extends Required<
    Omit<
      NodeTracerConfig,
      "resourceAttributes" | "instrumentations" | "sampler" | "filterTracer"
    >
  > {
  resourceAttributes: Record<string, unknown>;
  instrumentations: Instrumentation[];
  sampler?: Sampler;
  filterTracer?: (params: filterTracerParams) => boolean;
}

export class NodeTracer extends BaseTracer {
  private tracerProvider: NodeTracerProvider | null = null;
  private contextManager: AsyncLocalStorageContextManager | null = null;
  private resourceAttributes: Record<string, unknown>;
  private instrumentations: Instrumentation[];
  private sampler?: Sampler;
  private filterTracer?: (params: filterTracerParams) => boolean;

  private constructor(
    projectName: string,
    enableEvaluation: boolean,
    apiClient: JudgmentApiClient,
    serializer: Serializer,
    resourceAttributes: Record<string, unknown>,
    instrumentations: Instrumentation[],
    sampler?: Sampler,
    filterTracer?: (params: filterTracerParams) => boolean,
  ) {
    super(projectName, enableEvaluation, apiClient, serializer);
    this.resourceAttributes = resourceAttributes;
    this.instrumentations = instrumentations;
    this.sampler = sampler;
    this.filterTracer = filterTracer;
  }

  static async create(
    config: InternalNodeTracerConfig,
    apiClient: JudgmentApiClient,
  ): Promise<NodeTracer> {
    const tracer = new NodeTracer(
      config.projectName,
      config.enableEvaluation,
      apiClient,
      config.serializer,
      config.resourceAttributes,
      config.instrumentations,
      config.sampler,
      config.filterTracer,
    );

    await tracer.resolveAndSetProjectId();

    if (config.initialize) {
      await tracer.initialize();
    }

    return tracer;
  }

  /* eslint-disable @typescript-eslint/require-await */
  async initialize(): Promise<void> {
    if (this.tracerProvider !== null) {
      Logger.warn("NodeTracer already initialized");
      return;
    }

    try {
      this.contextManager = new AsyncLocalStorageContextManager();
      this.contextManager.enable();
      context.setGlobalContextManager(this.contextManager);

      const resource = defaultResource().merge(
        resourceFromAttributes({
          [ResourceKeys.SERVICE_NAME]: this.projectName,
          [ResourceKeys.TELEMETRY_SDK_NAME]: BaseTracer.TRACER_NAME,
          [ResourceKeys.TELEMETRY_SDK_VERSION]: VERSION,
          ...this.resourceAttributes,
        }),
      );

      this.tracerProvider = new JudgmentNodeTracerProvider({
        resource,
        sampler: this.sampler,
        spanProcessors: [this.getSpanProcessor()],
        filterTracer: this.filterTracer,
      });

      this.tracerProvider.register();

      if (this.instrumentations.length > 0) {
        registerInstrumentations({
          instrumentations: this.instrumentations,
        });
      }
      Logger.info("NodeTracer initialized successfully");
    } catch (error) {
      throw new Error(
        `Failed to initialize NodeTracer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async shutdown(): Promise<void> {
    if (!this.tracerProvider) {
      Logger.warn("NodeTracer not initialized, skipping shutdown");
      return;
    }
    try {
      await this.tracerProvider.shutdown();
      this.tracerProvider = null;

      if (this.contextManager) {
        this.contextManager.disable();
        this.contextManager = null;
      }

      Logger.info("NodeTracer shut down successfully");
    } catch (error) {
      Logger.error(`Failed to shutdown NodeTracer: ${error}`);
    }
  }
}
