import { JUDGMENT_API_KEY, JUDGMENT_API_URL, JUDGMENT_ORG_ID } from "./env";
import { JudgmentApiClient } from "./internal/api";
/**
 * Configuration options for the Judgeval client.
 *
 * Credentials are resolved in order: explicit arguments first, then
 * environment variables `JUDGMENT_API_KEY`, `JUDGMENT_ORG_ID`, and
 * `JUDGMENT_API_URL`.
 */
export interface JudgevalConfig {
  /** Judgment API key. Defaults to `JUDGMENT_API_KEY` env var. */
  apiKey?: string;
  /** Judgment organization ID. Defaults to `JUDGMENT_ORG_ID` env var. */
  organizationId?: string;
  /** Judgment API URL. Defaults to `JUDGMENT_API_URL` env var. */
  apiUrl?: string;
}

/**
 * The main entry point for interacting with the Judgment platform.
 *
 * `Judgeval` connects to your Judgment project and gives you access to
 * tracing, evaluation, and monitoring through the Judgment platform.
 *
 * @example
 * ```typescript
 * import { Judgeval } from "judgeval";
 *
 * const client = Judgeval.create();
 * ```
 *
 * @throws Error if any required credential is missing.
 */
export class Judgeval {
  private readonly internalClient: JudgmentApiClient;

  protected constructor(config: JudgevalConfig = {}) {
    const apiKey = config.apiKey ?? JUDGMENT_API_KEY;
    const organizationId = config.organizationId ?? JUDGMENT_ORG_ID;
    const apiUrl = config.apiUrl ?? JUDGMENT_API_URL;

    if (!apiKey) {
      throw new Error("API key is required");
    }
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }
    if (!apiUrl) {
      throw new Error("API URL is required");
    }

    this.internalClient = new JudgmentApiClient(apiUrl, apiKey, organizationId);
  }

  /**
   * Create a new Judgeval client instance.
   *
   * @param config - Configuration options. Credentials default to environment variables.
   * @returns A new `Judgeval` instance.
   *
   * @example
   * ```typescript
   * const client = Judgeval.create({
   *   apiKey: "<your-api-key>",
   *   organizationId: "<your-organization-id>",
   * });
   * ```
   */
  static create(config: JudgevalConfig = {}): Judgeval {
    return new Judgeval(config);
  }
}
