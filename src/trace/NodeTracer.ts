import {
  defaultResource,
  resourceFromAttributes,
} from "@opentelemetry/resources";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { JUDGMENT_API_KEY, JUDGMENT_API_URL, JUDGMENT_ORG_ID } from "../env";
import { JudgmentApiClient } from "../internal/api";
import { Logger } from "../utils/logger";
import { resolveProjectId } from "../utils/resolveProjectId";
import { safeStringify } from "../utils/serializer";
import { VERSION } from "../version";
import { BaseTracer } from "./BaseTracer";
import { ProxyTracerProvider } from "./ProxyTracerProvider";
import { JudgmentSpanExporter } from "./exporters/JudgmentSpanExporter";
import { NoOpSpanExporter } from "./exporters/NoOpSpanExporter";
import { JudgmentSpanProcessor } from "./processors/JudgmentSpanProcessor";
import { NoOpSpanProcessor } from "./processors/NoOpSpanProcessor";
import type { TracerConfig } from "./types";

export class NodeTracer extends BaseTracer {
  private _spanExporter: JudgmentSpanExporter | null = null;
  private _spanProcessor: JudgmentSpanProcessor | null = null;
  private _enableMonitoring: boolean;

  private constructor(
    projectName: string | null,
    projectId: string | null,
    apiKey: string | null,
    organizationId: string | null,
    apiUrl: string | null,
    environment: string | null,
    serializer: (v: unknown) => string,
    tracerProvider: NodeTracerProvider,
    enableMonitoring: boolean,
    client: JudgmentApiClient | null,
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
    );
    this._enableMonitoring = enableMonitoring;
    this._client = client;
  }

  static async init(config: TracerConfig = {}): Promise<NodeTracer> {
    const apiKey = config.apiKey ?? JUDGMENT_API_KEY;
    const organizationId = config.organizationId ?? JUDGMENT_ORG_ID;
    const apiUrl = config.apiUrl ?? JUDGMENT_API_URL;
    const projectName = config.projectName ?? null;
    const serializer = config.serializer ?? safeStringify;

    let enableMonitoring = true;

    if (!projectName) {
      Logger.warning(
        "project_name not provided. Tracer will not export spans.",
      );
      enableMonitoring = false;
    }
    if (!apiKey) {
      Logger.warning("api_key not provided. Tracer will not export spans.");
      enableMonitoring = false;
    }
    if (!organizationId) {
      Logger.warning(
        "organization_id not provided. Tracer will not export spans.",
      );
      enableMonitoring = false;
    }
    if (!apiUrl) {
      Logger.warning("api_url not provided. Tracer will not export spans.");
      enableMonitoring = false;
    }

    let client: JudgmentApiClient | null = null;
    let projectId: string | null = null;

    if (enableMonitoring && projectName && apiKey && organizationId && apiUrl) {
      client = new JudgmentApiClient(apiUrl, apiKey, organizationId);
      projectId = await resolveProjectId(client, projectName).catch(() => null);
      if (!projectId) {
        Logger.warning(
          `Project '${projectName}' not found. Tracer will not export spans.`,
        );
        enableMonitoring = false;
      }
    }

    const resourceAttrs: Record<string, string> = {
      "service.name": projectName ?? "unknown",
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

    const tracerProvider = new NodeTracerProvider({ resource });

    const tracer = new NodeTracer(
      projectName,
      projectId,
      apiKey,
      organizationId,
      apiUrl,
      config.environment ?? null,
      serializer,
      tracerProvider,
      enableMonitoring,
      client,
    );

    if (enableMonitoring) {
      const providerWithProcessor = new NodeTracerProvider({
        resource,
        spanProcessors: [tracer.getSpanProcessor()],
      });
      tracer._tracerProvider = providerWithProcessor;
    }

    const proxy = ProxyTracerProvider.getInstance();
    proxy.register(tracer);

    if (config.setActive ?? true) {
      tracer.setActive();
    }

    return tracer;
  }

  setActive(): boolean {
    const proxy = ProxyTracerProvider.getInstance();
    return proxy.setActive(this);
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
