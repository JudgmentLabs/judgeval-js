import { resourceFromAttributes } from "@opentelemetry/resources";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { VERSION } from "../version";
import { OpenTelemetryKeys } from "./OpenTelemetryKeys";
import { Tracer, TracerInitializeOptions, TracerOptions } from "./Tracer";
import { TracerConfiguration } from "./TracerConfiguration";

export type BrowserTracerInitializeOptions = TracerInitializeOptions & {};

export class BrowserTracer extends Tracer {
  private webTracerProvider?: WebTracerProvider;

  public async initialize(
    options: BrowserTracerInitializeOptions = {},
  ): Promise<BrowserTracer> {
    if (this._initialized) {
      return this;
    }

    try {
      const resourceAttributes = {
        [OpenTelemetryKeys.ResourceKeys.SERVICE_NAME]: this.projectName,
        [OpenTelemetryKeys.ResourceKeys.TELEMETRY_SDK_VERSION]: VERSION,
        ...options.resourceAttributes,
      };

      this.webTracerProvider = new WebTracerProvider({
        resource: resourceFromAttributes(resourceAttributes),
      });

      this.webTracerProvider.register();

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
        `Failed to initialize browser tracer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public static getInstance(
    projectName: string,
    options: TracerOptions = {},
  ): BrowserTracer {
    const key = `BrowserTracer:${projectName}`;
    if (!Tracer.instances.has(key)) {
      Tracer.instances.set(key, new BrowserTracer(projectName, options));
    }
    return Tracer.instances.get(key) as BrowserTracer;
  }

  public static createDefault(projectName: string): BrowserTracer {
    return BrowserTracer.getInstance(projectName);
  }

  public static createWithConfiguration(
    configuration: TracerConfiguration,
  ): BrowserTracer {
    return BrowserTracer.getInstance(configuration.projectName, {
      apiKey: configuration.apiKey,
      organizationId: configuration.organizationId,
      enableEvaluation: configuration.enableEvaluation,
    });
  }
}
