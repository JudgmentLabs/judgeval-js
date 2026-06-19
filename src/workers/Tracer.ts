import {
  defaultResource,
  resourceFromAttributes,
} from "@opentelemetry/resources";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { JudgmentApiClient } from "../internal/api";
import { resolveProjectId } from "../utils/resolve-project-id";
import { safeStringify } from "../utils/serializer";
import { VERSION } from "../version";
import { BaseTracer, type TracerConfig } from "../trace/BaseTracer";
import { JudgmentSpanExporter } from "../trace/exporters/JudgmentSpanExporter";
import { NoOpSpanExporter } from "../trace/exporters/NoOpSpanExporter";
import { JudgmentSpanProcessor } from "../trace/processors/JudgmentSpanProcessor";
import { NoOpSpanProcessor } from "../trace/processors/NoOpSpanProcessor";
import { WorkerTracerProvider } from "./WorkerTracerProvider";

export interface WorkersTracerConfig extends Omit<
  TracerConfig,
  "apiKey" | "apiUrl" | "organizationId" | "projectName"
> {
  /** Your Judgment project name. Required; Workers do not read process.env. */
  projectName: string;
  /** Judgment API key. Required; Workers do not read process.env. */
  apiKey: string;
  /** Judgment organization ID. Required; Workers do not read process.env. */
  organizationId: string;
  /** Judgment API URL. Required; Workers do not read process.env. */
  apiUrl: string;
}

function requireConfigValue(value: string | undefined, key: string): string {
  if (!value) {
    throw new Error(`${key} is required for judgeval/workers Tracer.init`);
  }
  return value;
}

export class Tracer extends BaseTracer {
  private _spanExporter: JudgmentSpanExporter | null = null;
  private _spanProcessor: JudgmentSpanProcessor | null = null;

  protected constructor(
    projectName: string,
    projectId: string,
    apiKey: string,
    organizationId: string,
    apiUrl: string,
    environment: string | null,
    serializer: (v: unknown) => string,
    tracerProvider: WebTracerProvider,
    client: JudgmentApiClient,
  ) {
    super(
      projectName,
      projectId,
      apiKey,
      organizationId,
      apiUrl,
      environment,
      serializer,
      tracerProvider,
      client,
      true,
    );
  }

  static async init(config: WorkersTracerConfig): Promise<Tracer> {
    const apiKey = requireConfigValue(config.apiKey, "apiKey");
    const organizationId = requireConfigValue(
      config.organizationId,
      "organizationId",
    );
    const apiUrl = requireConfigValue(config.apiUrl, "apiUrl");
    const projectName = requireConfigValue(config.projectName, "projectName");
    const serializer = config.serializer ?? safeStringify;

    const client = new JudgmentApiClient(apiUrl, apiKey, organizationId);
    let projectId: string;
    try {
      projectId = await resolveProjectId(client, projectName);
    } catch (err) {
      throw new Error(
        `Project '${projectName}' not found; cannot start judgeval/workers tracer: ${String(err)}`,
      );
    }

    const resourceAttrs: Record<string, string> = {
      "service.name": projectName,
      "telemetry.sdk.name": "judgeval",
      "telemetry.sdk.version": VERSION,
    };
    if (config.environment) {
      resourceAttrs["deployment.environment"] = config.environment;
    }
    if (config.resourceAttributes) {
      Object.assign(resourceAttrs, config.resourceAttributes);
    }

    const resource = defaultResource().merge(
      resourceFromAttributes(resourceAttrs),
    );

    const tracer = new Tracer(
      projectName,
      projectId,
      apiKey,
      organizationId,
      apiUrl,
      config.environment ?? null,
      serializer,
      new WebTracerProvider({
        resource,
        sampler: config.sampler,
        spanLimits: config.spanLimits,
      }),
      client,
    );

    const providerWithProcessor = new WebTracerProvider({
      resource,
      sampler: config.sampler,
      spanLimits: config.spanLimits,
      spanProcessors: [
        tracer.getSpanProcessor(),
        ...(config.spanProcessors ?? []),
      ],
    });
    tracer._tracerProvider = providerWithProcessor;

    const proxy = WorkerTracerProvider.getInstance();
    proxy.register(tracer);

    if (config.setActive ?? true) {
      tracer.setActive();
    }

    return tracer;
  }

  getSpanExporter(): JudgmentSpanExporter {
    if (this._spanExporter) return this._spanExporter;

    if (
      !this._enableMonitoring ||
      !this.projectId ||
      !this.apiKey ||
      !this.organizationId ||
      !this.apiUrl
    ) {
      this._spanExporter = new NoOpSpanExporter();
    } else {
      const endpoint = this.apiUrl.endsWith("/")
        ? this.apiUrl + "otel/v1/traces"
        : this.apiUrl + "/otel/v1/traces";
      this._spanExporter = new JudgmentSpanExporter(
        endpoint,
        this.apiKey,
        this.organizationId,
        this.projectId,
      );
    }
    return this._spanExporter;
  }

  getSpanProcessor(): JudgmentSpanProcessor {
    if (this._spanProcessor) return this._spanProcessor;

    if (!this._enableMonitoring) {
      this._spanProcessor = new NoOpSpanProcessor();
    } else {
      this._spanProcessor = new JudgmentSpanProcessor(
        this,
        this.getSpanExporter(),
      );
    }
    return this._spanProcessor;
  }
}
