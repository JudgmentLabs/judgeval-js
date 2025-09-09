import { ExportResult } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import { Logger } from "../../utils/logger";
import { OpenTelemetryKeys } from "../OpenTelemetryKeys";

export class JudgmentSpanExporter implements SpanExporter {
  private readonly delegate: OTLPTraceExporter;
  private readonly projectId: string;

  constructor(
    endpoint: string,
    apiKey: string,
    organizationId: string,
    projectId: string
  ) {
    if (!projectId || projectId.trim() === "") {
      throw new Error("projectId is required for JudgmentSpanExporter");
    }

    this.delegate = new OTLPTraceExporter({
      url: endpoint,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Organization-Id": organizationId,
      },
    });
    this.projectId = projectId;
  }

  /**
   * Creates a new builder for constructing JudgmentSpanExporter instances.
   */
  public static builder(): JudgmentSpanExporterBuilder {
    return new JudgmentSpanExporterBuilder();
  }

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    Logger.info(
      `JudgmentSpanExporter exporting spans: count=${spans ? spans.length : 0}`
    );

    const projectIdResource = new Resource({
      [OpenTelemetryKeys.ResourceKeys.JUDGMENT_PROJECT_ID]: this.projectId,
    });

    const spansWithProjectId = spans.map((span) => {
      const originalResource = span.resource || new Resource({});
      const mergedResource = originalResource.merge(projectIdResource);

      return Object.assign(Object.create(Object.getPrototypeOf(span)), span, {
        resource: mergedResource,
      });
    });

    this.delegate.export(spansWithProjectId, (result) => {
      if (result.code !== 0) {
        Logger.error(
          `Failed to export spans: ${result.error?.message || "Unknown error"}`
        );
      }
      resultCallback(result);
    });
  }

  flush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return this.delegate.shutdown();
  }
}

export class JudgmentSpanExporterBuilder {
  private _endpoint?: string;
  private _apiKey?: string;
  private _organizationId?: string;
  private _projectId?: string;

  constructor() {}

  /**
   * Sets the OTLP endpoint URL.
   */
  public endpoint(endpoint: string): this {
    this._endpoint = endpoint;
    return this;
  }

  /**
   * Sets the API key for authentication.
   */
  public apiKey(apiKey: string): this {
    this._apiKey = apiKey;
    return this;
  }

  /**
   * Sets the organization ID.
   */
  public organizationId(organizationId: string): this {
    this._organizationId = organizationId;
    return this;
  }

  /**
   * Sets the project ID.
   */
  public projectId(projectId: string): this {
    this._projectId = projectId;
    return this;
  }

  /**
   * Builds a new JudgmentSpanExporter with the current configuration.
   */
  public build(): JudgmentSpanExporter {
    if (!this._endpoint || this._endpoint.trim() === "") {
      throw new Error("Endpoint is required");
    }
    if (!this._apiKey || this._apiKey.trim() === "") {
      throw new Error("API key is required");
    }
    if (!this._organizationId || this._organizationId.trim() === "") {
      throw new Error("Organization ID is required");
    }
    if (!this._projectId || this._projectId.trim() === "") {
      throw new Error("Project ID is required");
    }

    return new JudgmentSpanExporter(
      this._endpoint,
      this._apiKey,
      this._organizationId,
      this._projectId
    );
  }
}

export { NoOpSpanExporter } from "./NoOpSpanExporter";
