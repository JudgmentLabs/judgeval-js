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
/** How long one request may take before it is abandoned and retried. */
const REQUEST_TIMEOUT_MILLIS = 30000;

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
    const rejection = await this._send(batch);
    if (rejection === undefined) return;
    if (batch.length > 1) await this._dropInvalid(batch);
    else this._logDropped(1, rejection);
  }

  /**
   * The server rejects a request when any observation in it does not fit the
   * format; this finds which by halving the batch. When both halves are
   * rejected, the fault is most likely in the request as a whole, such as a
   * clock more than five minutes fast, so the batch is dropped rather than
   * split further.
   */
  private async _dropInvalid(batch: SentObservation[]): Promise<void> {
    const middle = Math.floor(batch.length / 2);
    const halves = [batch.slice(0, middle), batch.slice(middle)];
    const rejections = [
      await this._send(halves[0]),
      await this._send(halves[1]),
    ];
    if (rejections[0] !== undefined && rejections[1] !== undefined) {
      this._logDropped(batch.length, rejections[0]);
      return;
    }
    for (const [index, half] of halves.entries()) {
      const rejection = rejections[index];
      if (rejection === undefined) continue;
      if (half.length > 1) await this._dropInvalid(half);
      else this._logDropped(1, rejection);
    }
  }

  /**
   * Sends a batch, retrying temporary failures. Returns the server's reason
   * when it rejects the batch as invalid (400); handles every other outcome.
   */
  private async _send(batch: SentObservation[]): Promise<string | undefined> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let status: number | undefined;
      let retryAfterSeconds = 0;
      let detail: string;
      try {
        const { response, error } =
          await this._client.postV1projectsObservations(
            this._projectId,
            { observations: batch },
            AbortSignal.timeout(REQUEST_TIMEOUT_MILLIS),
          );
        if (response.ok) return undefined;
        status = response.status;
        retryAfterSeconds = Number(response.headers.get("Retry-After")) || 0;
        detail = JSON.stringify(error);
      } catch (error) {
        detail = String(error);
      }
      if (status === 400) return detail;
      if (status === 402 || status === 404) {
        this._reportOnce(status);
        return undefined;
      }
      if (
        (status !== undefined && !isRetryable(status)) ||
        attempt === MAX_ATTEMPTS - 1
      ) {
        this._logDropped(
          batch.length,
          `${status ?? "network error"} ${detail}`,
        );
        return undefined;
      }
      await backoff(attempt, retryAfterSeconds);
    }
    return undefined;
  }

  private _logDropped(count: number, reason: string): void {
    Logger.error(`[Trajectory] Dropped ${count} observations: ${reason}`);
  }

  private _reportOnce(status: number): void {
    if (this._reported.has(status)) return;
    this._reported.add(status);
    const reason =
      status === 402
        ? "the organization is over its ingestion usage limit"
        : "conversations are not enabled for this organization";
    Logger.warn(`[Trajectory] Observations are not stored: ${reason}`);
  }
}
