import {
  defaultResource,
  resourceFromAttributes,
} from "@opentelemetry/resources";
import type { Sampler, SpanLimits } from "@opentelemetry/sdk-trace-base";
import { type SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import type { Example } from "../data/Example";
import { JUDGMENT_API_KEY, JUDGMENT_API_URL, JUDGMENT_ORG_ID } from "../env";
import { JudgmentApiClient } from "../internal/api";
import { resolveProjectId } from "../utils/resolve-project-id";
import { safeStringify } from "../utils/serializer";
import { VERSION } from "../version";
import { JudgmentTracerProvider } from "./JudgmentTracerProvider";
import { Tracer } from "./Tracer";
import { JudgmentSpanExporter } from "./exporters/JudgmentSpanExporter";
import { OfflineJudgmentSpanProcessor } from "./processors/OfflineJudgmentSpanProcessor";

const OFFLINE_TRACES_PATH = "otel/v1/offline-traces";

/**
 * Configuration for `OfflineTracer.create()`.
 */
export interface OfflineTracerConfig {
  /** List that receives an `Example` for each completed root span. */
  dataset: Example[];
  /**
   * Fields included on every `Example` in `dataset`
   * (e.g. `{ input: ..., goldenOutput: ... }`).
   */
  exampleFields?: Record<string, unknown>;
  /** Your Judgment project name. Required. */
  projectName?: string;
  /** Judgment API key. Defaults to `JUDGMENT_API_KEY` env var. */
  apiKey?: string;
  /** Judgment organization ID. Defaults to `JUDGMENT_ORG_ID` env var. */
  organizationId?: string;
  /** Judgment API URL. Defaults to `JUDGMENT_API_URL` env var. */
  apiUrl?: string;
  /** Deployment environment name (e.g. "production"). */
  environment?: string;
  /** Whether to set this tracer as active. Defaults to `true`. */
  setActive?: boolean;
  /** Custom serialization function for span attribute values. */
  serializer?: (value: unknown) => string;
  /** Additional OpenTelemetry resource attributes. */
  resourceAttributes?: Record<string, string>;
  /** Custom OpenTelemetry sampler. */
  sampler?: Sampler;
  /** Custom OpenTelemetry span limits. */
  spanLimits?: SpanLimits;
  /** Additional OpenTelemetry span processors. */
  spanProcessors?: SpanProcessor[];
}

/**
 * Tracer for offline / experiment-style runs.
 *
 * Behaves like `Tracer` for span creation and `@Tracer.observe`, with
 * two differences:
 *
 * * Spans are pushed to the project's *offline* OTLP endpoint and stored
 *   in the `offline_otel_traces` ClickHouse table. They do **not** appear
 *   on the live monitoring page.
 * * Each completed root span produces a new `Example` that is appended
 *   to the caller-supplied `dataset` list. The example carries the
 *   `offline_trace_id` of the offline trace plus any static
 *   `exampleFields` configured at init time.
 *
 * Unlike `Tracer`, `OfflineTracer` requires all credentials upfront and
 * throws if any are missing — there is no no-op fallback. Prefer
 * `judgeval.offlineTracer({ ... })` over calling `OfflineTracer.create`
 * directly so credentials are reused from the active `Judgeval` client.
 *
 * @example
 * ```typescript
 * import { Judgeval, type Example } from "judgeval";
 *
 * const judgeval = await Judgeval.create({ projectName: "my-project" });
 * const dataset: Example[] = [];
 * const tracer = await judgeval.offlineTracer({
 *   dataset,
 *   exampleFields: { input: "What is 2+2?", expected_output: "4" },
 * });
 * ```
 */
export class OfflineTracer extends Tracer {
  readonly supportsLiveInstrumentation: boolean = false;

  private readonly _offlineApiUrl: string;
  private readonly _offlineApiKey: string;
  private readonly _offlineOrganizationId: string;
  private readonly _offlineProjectId: string;

  private readonly _dataset: Example[];
  private readonly _exampleFields: Record<string, unknown>;

  private _offlineSpanExporter: JudgmentSpanExporter | null = null;
  private _offlineSpanProcessor: OfflineJudgmentSpanProcessor | null = null;

  private constructor(args: {
    projectName: string;
    projectId: string;
    apiKey: string;
    organizationId: string;
    apiUrl: string;
    environment: string | null;
    serializer: (value: unknown) => string;
    tracerProvider: NodeTracerProvider;
    client: JudgmentApiClient;
    dataset: Example[];
    exampleFields: Record<string, unknown>;
  }) {
    super(
      args.projectName,
      args.projectId,
      args.apiKey,
      args.organizationId,
      args.apiUrl,
      args.environment,
      args.serializer,
      args.tracerProvider,
      args.client,
      true,
    );
    this._offlineApiUrl = args.apiUrl;
    this._offlineApiKey = args.apiKey;
    this._offlineOrganizationId = args.organizationId;
    this._offlineProjectId = args.projectId;
    this._dataset = args.dataset;
    this._exampleFields = args.exampleFields;
  }

  /**
   * Create and activate a new `OfflineTracer`.
   *
   * @throws Error if `projectName`, `apiKey`, `organizationId`, or
   *   `apiUrl` cannot be resolved (explicit arg or env var), or if the
   *   project cannot be found on the backend.
   */
  static async create(config: OfflineTracerConfig): Promise<OfflineTracer> {
    const apiKey = config.apiKey ?? JUDGMENT_API_KEY;
    const organizationId = config.organizationId ?? JUDGMENT_ORG_ID;
    const apiUrl = config.apiUrl ?? JUDGMENT_API_URL;
    const projectName = config.projectName;
    const serializer = config.serializer ?? safeStringify;

    if (!projectName) {
      throw new Error("projectName is required for OfflineTracer");
    }
    if (!apiKey) {
      throw new Error("apiKey is required for OfflineTracer");
    }
    if (!organizationId) {
      throw new Error("organizationId is required for OfflineTracer");
    }
    if (!apiUrl) {
      throw new Error("apiUrl is required for OfflineTracer");
    }

    const client = new JudgmentApiClient(apiUrl, apiKey, organizationId);
    let projectId: string;
    try {
      projectId = await resolveProjectId(client, projectName);
    } catch (err) {
      throw new Error(
        `Project '${projectName}' not found; cannot start OfflineTracer: ${String(err)}`,
      );
    }

    const resourceAttrs: Record<string, string> = {
      "service.name": projectName,
      "telemetry.sdk.name": "judgeval",
      "telemetry.sdk.version": VERSION,
      "judgment.offline": "true",
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

    const tracer = new OfflineTracer({
      projectName,
      projectId,
      apiKey,
      organizationId,
      apiUrl,
      environment: config.environment ?? null,
      serializer,
      tracerProvider: new NodeTracerProvider({ resource }),
      client,
      dataset: config.dataset,
      exampleFields: { ...(config.exampleFields ?? {}) },
    });

    const providerWithProcessor = new NodeTracerProvider({
      resource,
      sampler: config.sampler,
      spanLimits: config.spanLimits,
      spanProcessors: [
        tracer.getSpanProcessor(),
        ...(config.spanProcessors ?? []),
      ],
    });
    tracer._tracerProvider = providerWithProcessor;

    const proxy = JudgmentTracerProvider.getInstance();
    proxy.register(tracer);

    if (config.setActive ?? true) {
      tracer.setActive();
    }

    return tracer;
  }

  /**
   * Return the offline span exporter for this tracer.
   *
   * Targets the project's offline OTLP endpoint. Credentials are
   * guaranteed present (validated in `create`).
   */
  getSpanExporter(): JudgmentSpanExporter {
    if (this._offlineSpanExporter) return this._offlineSpanExporter;
    const base = this._offlineApiUrl.endsWith("/")
      ? this._offlineApiUrl + OFFLINE_TRACES_PATH
      : this._offlineApiUrl + "/" + OFFLINE_TRACES_PATH;
    this._offlineSpanExporter = new JudgmentSpanExporter(
      base,
      this._offlineApiKey,
      this._offlineOrganizationId,
      this._offlineProjectId,
    );
    return this._offlineSpanExporter;
  }

  /** Return the offline span processor for this tracer. */
  getSpanProcessor(): OfflineJudgmentSpanProcessor {
    if (this._offlineSpanProcessor) return this._offlineSpanProcessor;
    this._offlineSpanProcessor = new OfflineJudgmentSpanProcessor(
      this,
      this.getSpanExporter(),
      {
        dataset: this._dataset,
        exampleFields: this._exampleFields,
      },
    );
    return this._offlineSpanProcessor;
  }
}
