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
import {
  type Sampler,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
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
  initialize?: boolean;
  filterTracer?: (params: filterTracerParams) => boolean;
}

interface InternalNodeTracerConfig extends Required<
  Omit<
    NodeTracerConfig,
    "resourceAttributes" | "instrumentations" | "filterTracer"
  >
> {
  resourceAttributes: Record<string, unknown>;
  instrumentations: Instrumentation[];
  filterTracer?: (params: filterTracerParams) => boolean;
  sampler?: Sampler;
}

export interface InitializeNodeTracerConfig {
  spanProcessors?: SpanProcessor[];
  resourceAttributes?: Record<string, unknown>;
  instrumentations?: Instrumentation[];
  sampler?: Sampler;
}

export class NodeTracer extends BaseTracer {
  private tracerProvider: NodeTracerProvider | null = null;
  private contextManager: AsyncLocalStorageContextManager | null = null;
  private resourceAttributes: Record<string, unknown>;
  private instrumentations: Instrumentation[];
  private filterTracer?: (params: filterTracerParams) => boolean;

  private constructor(
    projectName: string,
    enableEvaluation: boolean,
    apiClient: JudgmentApiClient,
    serializer: Serializer,
    resourceAttributes: Record<string, unknown>,
    instrumentations: Instrumentation[],
    filterTracer?: (params: filterTracerParams) => boolean,
  ) {
    super(projectName, enableEvaluation, apiClient, serializer);
    this.resourceAttributes = resourceAttributes;
    this.instrumentations = instrumentations;
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
      config.filterTracer,
    );

    await tracer.resolveAndSetProjectId();

    if (config.initialize) {
      await tracer.initialize({ sampler: config.sampler });
    }

    return tracer;
  }

  /* eslint-disable @typescript-eslint/require-await */
  async initialize(config?: InitializeNodeTracerConfig): Promise<void> {
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
          ...config?.resourceAttributes,
        }),
      );

      const spanProcessors = [
        this.getSpanProcessor(),
        ...(config?.spanProcessors ?? []),
      ];

      this.tracerProvider = new JudgmentNodeTracerProvider({
        resource,
        sampler: config?.sampler,
        spanProcessors,
        filterTracer: this.filterTracer,
      });

      this.tracerProvider.register();

      const allInstrumentations = [
        ...this.instrumentations,
        ...(config?.instrumentations ?? []),
      ];

      if (allInstrumentations.length > 0) {
        registerInstrumentations({
          instrumentations: allInstrumentations,
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

  async forceFlush(): Promise<void> {
    if (!this.tracerProvider) {
      Logger.warn("NodeTracer not initialized, skipping force flush");
      return;
    }
    try {
      await this.tracerProvider.forceFlush();
    } catch (error) {
      Logger.error(`Failed to force flush NodeTracer: ${error}`);
    }
  }
}
