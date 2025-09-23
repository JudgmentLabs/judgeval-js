import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK, NodeSDKConfiguration } from "@opentelemetry/sdk-node";
import { VERSION } from "../version";
import { OpenTelemetryKeys } from "./OpenTelemetryKeys";
import { Tracer, TracerInitializeOptions, TracerOptions } from "./Tracer";
import { TracerConfiguration } from "./TracerConfiguration";

export type NodeTracerInitializeOptions = TracerInitializeOptions & {
  instrumentations?: NodeSDKConfiguration["instrumentations"];
  resourceAttributes?: Record<string, unknown>;
};

export class NodeTracer extends Tracer {
  private nodeSDK?: NodeSDK;

  public async initialize(
    options: NodeTracerInitializeOptions = {},
  ): Promise<NodeTracer> {
    if (this._initialized) {
      return this;
    }

    try {
      const resourceAttributes = {
        [OpenTelemetryKeys.ResourceKeys.SERVICE_NAME]: this.projectName,
        [OpenTelemetryKeys.ResourceKeys.TELEMETRY_SDK_VERSION]: VERSION,
        ...options.resourceAttributes,
      };

      this.nodeSDK = new NodeSDK({
        resource: resourceFromAttributes(resourceAttributes),
        instrumentations: options.instrumentations,
        ...options,
      });

      this.nodeSDK.start();

      this.configuration = TracerConfiguration.builder()
        .projectName(this.projectName)
        .apiKey(this.apiKey)
        .organizationId(this.organizationId)
        .enableEvaluation(this.enableEvaluation)
        .build();

      this._initialized = true;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to initialize node tracer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public static getInstance(
    projectName: string,
    options: TracerOptions = {},
  ): NodeTracer {
    const key = `NodeTracer:${projectName}`;
    if (!Tracer.instances.has(key)) {
      Tracer.instances.set(key, new NodeTracer(projectName, options));
    }
    return Tracer.instances.get(key) as NodeTracer;
  }

  public static createDefault(projectName: string): NodeTracer {
    return NodeTracer.getInstance(projectName);
  }

  public static createWithConfiguration(
    configuration: TracerConfiguration,
  ): NodeTracer {
    return NodeTracer.getInstance(configuration.projectName, {
      apiKey: configuration.apiKey,
      organizationId: configuration.organizationId,
      enableEvaluation: configuration.enableEvaluation,
    });
  }

  public async shutdown(): Promise<void> {
    if (this.nodeSDK) {
      await this.nodeSDK.shutdown();
    }
  }
}
