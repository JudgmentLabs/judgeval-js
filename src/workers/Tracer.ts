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
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";
import type { JudgmentSpanExporter } from "../trace/exporters/JudgmentSpanExporter";
import { JudgmentSpanProcessor } from "../trace/processors/JudgmentSpanProcessor";
import { WorkerTracerProvider } from "./WorkerTracerProvider";
import { WorkerSpanExporter } from "./WorkerSpanExporter";

export interface WorkersTracerConfig extends Omit<
  TracerConfig,
  "apiKey" | "apiUrl" | "organizationId" | "projectName"
> {
  /** Your Judgment project name. Required when projectId is not provided. */
  projectName?: string;
  /** Pre-resolved Judgment project ID. Prefer this in Workers to avoid an init-time API lookup. */
  projectId?: string;
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
  private _spanExporter: SpanExporter | null = null;
  private _spanProcessor: JudgmentSpanProcessor | null = null;

  protected constructor(
    projectName: string | null,
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
    const serializer = config.serializer ?? safeStringify;

    const client = new JudgmentApiClient(apiUrl, apiKey, organizationId);
    let projectId = config.projectId;
    if (!projectId) {
      const projectName = requireConfigValue(config.projectName, "projectName");
      try {
        projectId = await resolveProjectId(client, projectName);
      } catch (err) {
        throw new Error(
          `Project '${projectName}' not found; cannot start judgeval/workers tracer: ${String(err)}`,
        );
      }
    }

    const serviceName = config.projectName ?? "unknown";
    const resourceAttrs: Record<string, string> = {
      "service.name": serviceName,
      "telemetry.sdk.name": "judgeval",
      "telemetry.sdk.version": VERSION,
      "judgment.project_id": projectId,
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
      config.projectName ?? null,
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
    if (this._spanExporter) return this._spanExporter as JudgmentSpanExporter;

    const endpoint = this.apiUrl!.endsWith("/")
      ? this.apiUrl + "otel/v1/traces"
      : this.apiUrl + "/otel/v1/traces";
    this._spanExporter = new WorkerSpanExporter(
      endpoint,
      this.apiKey!,
      this.organizationId!,
      this.projectId!,
    );
    return this._spanExporter as JudgmentSpanExporter;
  }

  getSpanProcessor(): JudgmentSpanProcessor {
    if (this._spanProcessor) return this._spanProcessor;

    this._spanProcessor = new JudgmentSpanProcessor(
      this,
      this.getSpanExporter(),
    );
    return this._spanProcessor;
  }
}
