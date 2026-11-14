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
/** The longest rejection reason logged. */
const MAX_REASON_LENGTH = 2000;

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
 * Reads a 400 from the observations route: the positions of the observations
 * it names, and a reason to log. Each validation issue has a path such as
 * `["observations", 3, "input", 0, "role"]`. The positions are empty when no
 * issue names an observation, as when the request as a whole is malformed or
 * the detail is not in this format. The reason lists each issue by path. It
 * never includes the detail itself, which can echo the request and so the
 * caller's conversation content.
 */
function readRejection(
  detail: string,
  count: number,
): { invalid: Set<number>; reason: string } {
  let issues: { path: unknown[]; message: string }[];
  let reason: string;
  try {
    issues = (JSON.parse(detail) as { errors: typeof issues }).errors;
    reason = issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
  } catch {
    return {
      invalid: new Set(),
      reason: "the request was rejected as invalid",
    };
  }
  const invalid = new Set<number>();
  for (const [scope, index] of issues.map((issue) => issue.path)) {
    if (
      scope === "observations" &&
      typeof index === "number" &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < count
    ) {
      invalid.add(index);
    }
  }
  return { invalid, reason: reason.slice(0, MAX_REASON_LENGTH) };
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
    const { invalid, reason } = readRejection(rejection, batch.length);
    if (invalid.size === 0) {
      this._logDropped(batch.length, reason);
      return;
    }
    // The server stores nothing from a rejected request, so the observations
    // it did not name are sent again, once.
    this._logDropped(invalid.size, reason);
    const rest = batch.filter((_, index) => !invalid.has(index));
    if (rest.length === 0) return;
    const second = await this._send(rest);
    if (second !== undefined) {
      this._logDropped(rest.length, readRejection(second, rest.length).reason);
    }
  }

  /**
   * Sends a batch, retrying temporary failures. Returns the server's detail
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
        // The spec declares no error bodies; a 400 carries its issues as
        // JSON text in `message`.
        const body = error as { message?: unknown } | undefined;
        detail =
          typeof body?.message === "string"
            ? body.message
            : JSON.stringify(error);
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
