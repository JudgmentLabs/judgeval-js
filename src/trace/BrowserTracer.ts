import { resourceFromAttributes } from "@opentelemetry/resources";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { safeStringify } from "../utils/serializer";
import { VERSION } from "../version";
import { BaseTracer } from "./BaseTracer";
import { ProxyTracerProvider } from "./ProxyTracerProvider";
import { JudgmentSpanExporter } from "./exporters/JudgmentSpanExporter";
import { NoOpSpanExporter } from "./exporters/NoOpSpanExporter";
import { JudgmentSpanProcessor } from "./processors/JudgmentSpanProcessor";
import { NoOpSpanProcessor } from "./processors/NoOpSpanProcessor";
import type { TracerConfig } from "./types";

export interface BrowserTracerConfig extends TracerConfig {
  projectId?: string;
}

export class BrowserTracer extends BaseTracer {
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
    tracerProvider: WebTracerProvider,
    enableMonitoring: boolean,
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
  }

  static init(config: BrowserTracerConfig = {}): BrowserTracer {
    const apiKey = config.apiKey ?? null;
    const organizationId = config.organizationId ?? null;
    const apiUrl = config.apiUrl ?? "https://api.judgmentlabs.ai";
    const projectName = config.projectName ?? null;
    const projectId = config.projectId ?? null;
    const serializer = config.serializer ?? safeStringify;

    let enableMonitoring = true;

    if (!projectName) enableMonitoring = false;
    if (!projectId) enableMonitoring = false;
    if (!apiKey) enableMonitoring = false;
    if (!organizationId) enableMonitoring = false;
    if (!apiUrl) enableMonitoring = false;

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

    const resource = resourceFromAttributes(resourceAttrs);

    const tracerProvider = new WebTracerProvider({ resource });

    const tracer = new BrowserTracer(
      projectName,
      projectId,
      apiKey,
      organizationId,
      apiUrl,
      config.environment ?? null,
      serializer,
      tracerProvider,
      enableMonitoring,
    );

    if (enableMonitoring) {
      const providerWithProcessor = new WebTracerProvider({
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
