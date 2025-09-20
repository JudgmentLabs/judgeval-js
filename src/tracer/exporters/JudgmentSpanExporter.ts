import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

export class JudgmentSpanExporter extends OTLPTraceExporter {
  constructor(
    endpoint: string,
    apiKey: string,
    organizationId: string,
    projectId: string
  ) {
    if (!projectId || projectId.trim() === "") {
      throw new Error("projectId is required for JudgmentSpanExporter");
    }

    super({
      url: endpoint,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Organization-Id": organizationId,
        "X-Project-Id": projectId,
      },
    });
  }

  /**
   * Creates a new builder for constructing JudgmentSpanExporter instances.
   */
  public static builder(): JudgmentSpanExporterBuilder {
    return new JudgmentSpanExporterBuilder();
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
