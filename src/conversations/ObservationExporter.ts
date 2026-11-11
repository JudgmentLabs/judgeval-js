import type { JudgmentApiClient } from "../internal/api";
import type { RequestBody } from "../internal/api/models";
import { Logger } from "../utils/logger";

/** One observation as the ingest route takes it. */
export type SentObservation = RequestBody<
  "/v1/projects/{projectId}/observations",
  "post"
>["observations"][number];

/** How many times a batch is sent before a temporary failure drops it. */
const MAX_ATTEMPTS = 3;
/** The longest wait between attempts, whatever the server's Retry-After says. */
const MAX_BACKOFF_SECONDS = 30;

/**
 * Server errors, timeouts, and rate limits may pass on retry; other client
 * errors will not.
 */
function isRetryable(status: number): boolean {
  return !(status >= 400 && status < 500 && status !== 408 && status !== 429);
}

/**
 * Waits exponentially longer after each attempt, and at least as long as the
 * server's Retry-After; both are capped.
 */
function backoff(attempt: number, retryAfterSeconds: number): Promise<void> {
  const seconds = Math.max(
    Math.min(2 ** attempt, MAX_BACKOFF_SECONDS),
    Math.min(retryAfterSeconds, MAX_BACKOFF_SECONDS),
  );
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/**
 * Sends one batch of observations to Judgment. Never rejects: a batch that
 * cannot be stored is logged and dropped.
 */
export class ObservationExporter {
  private readonly _reported = new Set<number>();

  constructor(
    private readonly _client: JudgmentApiClient,
    private readonly _projectId: string,
  ) {}

  async export(batch: SentObservation[]): Promise<void> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let status: number | undefined;
      let retryAfterSeconds = 0;
      let detail: string;
      try {
        const { response, error } =
          await this._client.postV1projectsObservations(this._projectId, {
            observations: batch,
          });
        if (response.ok) return;
        status = response.status;
        retryAfterSeconds = Number(response.headers.get("Retry-After")) || 0;
        detail = JSON.stringify(error);
      } catch (error) {
        detail = String(error);
      }
      if (status === 400 && batch.length > 1) {
        // The server rejects a request when any observation in it does not
        // fit the format; find which by halving it.
        const middle = Math.floor(batch.length / 2);
        await this.export(batch.slice(0, middle));
        await this.export(batch.slice(middle));
        return;
      }
      if (status === 402 || status === 404) {
        this._reportOnce(status);
        return;
      }
      if (
        (status !== undefined && !isRetryable(status)) ||
        attempt === MAX_ATTEMPTS - 1
      ) {
        Logger.error(
          `[Conversations] Dropped ${batch.length} observations: ${status ?? "network error"} ${detail}`,
        );
        return;
      }
      await backoff(attempt, retryAfterSeconds);
    }
  }

  private _reportOnce(status: number): void {
    if (this._reported.has(status)) return;
    this._reported.add(status);
    const reason =
      status === 402
        ? "the organization is over its ingestion usage limit"
        : "conversations are not enabled for this organization";
    Logger.warn(`[Conversations] Observations are not stored: ${reason}`);
  }
}
