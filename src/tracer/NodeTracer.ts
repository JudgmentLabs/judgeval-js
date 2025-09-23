import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK, NodeSDKConfiguration } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { VERSION } from "../version";
import { OpenTelemetryKeys } from "./OpenTelemetryKeys";
import { Tracer, TracerInitializeOptions } from "./Tracer";
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
        [OpenTelemetryKeys.ResourceKeys.SERVICE_NAME]:
          this.configuration.projectName,
        [OpenTelemetryKeys.ResourceKeys.TELEMETRY_SDK_VERSION]: VERSION,
        ...options.resourceAttributes,
      };

      const spanExporter = await this.getSpanExporter();

      this.nodeSDK = new NodeSDK({
        resource: resourceFromAttributes(resourceAttributes),
        instrumentations: options.instrumentations,
        spanProcessor: new BatchSpanProcessor(spanExporter),
        ...options,
      });

      this.nodeSDK.start();

      this._initialized = true;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to initialize node tracer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public static getInstance(configuration: TracerConfiguration): NodeTracer {
    const key = `NodeTracer:${configuration.projectName}`;
    if (!Tracer.instances.has(key)) {
      Tracer.instances.set(key, new NodeTracer(configuration));
    }
    return Tracer.instances.get(key) as NodeTracer;
  }

  public static createDefault(projectName: string): NodeTracer {
    const configuration = TracerConfiguration.builder()
      .projectName(projectName)
      .enableEvaluation(true)
      .build();
    return NodeTracer.getInstance(configuration);
  }

  public static createWithConfiguration(
    configuration: TracerConfiguration,
  ): NodeTracer {
    return new NodeTracer(configuration);
  }

  public async shutdown(): Promise<void> {
    if (this.nodeSDK) {
      await this.nodeSDK.shutdown();
    }
  }
}
