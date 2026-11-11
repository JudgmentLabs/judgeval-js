import type { JudgmentApiClient } from "../internal/api";
import type { Observation, RequestBody } from "../internal/api/models";
import { Logger } from "../utils/logger";

type SentObservation = RequestBody<
  "/v1/projects/{projectId}/observations",
  "post"
>["observations"][number];

/** The most observations the server accepts in one request. */
const MAX_BATCH_SIZE = 100;
/** The most observations held while waiting to be sent; more are dropped. */
const MAX_QUEUE_SIZE = 2048;
/** How long an observation waits for its batch to fill before it is sent. */
const FLUSH_INTERVAL_MS = 1000;
/** How many times a batch is sent before a temporary failure drops it. */
const MAX_ATTEMPTS = 3;
/** Statuses that mean a retry may succeed. */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Queues observations for one project and sends them in the background, in
 * batches, never throwing. `Conversations` owns the active sender.
 */
export class ObservationSender {
  private readonly _queue: SentObservation[] = [];
  private readonly _reported = new Set<string>();
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _sending: Promise<void> | undefined;
  private _stopped = false;

  /**
   * @param _client - The API client, or null when recording is off.
   * @param _projectId - The project to record into, or null when recording
   *   is off.
   * @param _environment - The environment every call is sent with.
   */
  constructor(
    private readonly _client: JudgmentApiClient | null,
    private readonly _projectId: string | null,
    private readonly _environment: string | undefined,
  ) {}

  /** Queue one call; does nothing when recording is off or stopped. */
  enqueue(observation: Observation, observedAt: Date): void {
    if (this._client === null || this._projectId === null || this._stopped) {
      return;
    }
    if (this._queue.length >= MAX_QUEUE_SIZE) {
      this._reportOnce(
        "full",
        `Observation queue is full (${MAX_QUEUE_SIZE}); dropping observations until it drains`,
      );
      return;
    }
    this._queue.push({
      // Sent later, so copy it: changes the caller makes afterwards, such as
      // appending to a shared message history, are not sent.
      observation: structuredClone(observation),
      observed_at: observedAt.toISOString(),
      environment: this._environment,
    });
    if (this._queue.length >= MAX_BATCH_SIZE) void this._drain();
    this._scheduleDrain();
  }

  /** Send every queued call; never rejects. */
  async flush(): Promise<void> {
    clearTimeout(this._timer);
    this._timer = undefined;
    await this._drain();
  }

  /** Send queued calls, then ignore new ones. */
  async stop(): Promise<void> {
    await this.flush();
    this._stopped = true;
  }

  private _scheduleDrain(): void {
    if (this._timer !== undefined) return;
    this._timer = setTimeout(() => {
      this._timer = undefined;
      void this._drain();
    }, FLUSH_INTERVAL_MS);
    // Waiting to fill a batch must not keep the process alive.
    this._timer.unref();
  }

  private _drain(): Promise<void> {
    if (this._sending === undefined) {
      this._sending = this._sendQueued().finally(() => {
        this._sending = undefined;
      });
    }
    return this._sending;
  }

  private async _sendQueued(): Promise<void> {
    while (this._queue.length > 0) {
      const batch = this._queue.splice(0, MAX_BATCH_SIZE);
      try {
        await this._send(batch);
      } catch (error) {
        Logger.error(
          `[Conversations] Dropped ${batch.length} observations: ${String(error)}`,
        );
      }
    }
  }

  private async _send(batch: SentObservation[]): Promise<void> {
    const client = this._client;
    const projectId = this._projectId;
    if (client === null || projectId === null) return;
    for (let attempt = 1; ; attempt++) {
      let status: number | undefined;
      let retryAfterSeconds = 0;
      let detail: string;
      try {
        const { response, error } = await client.postV1projectsObservations(
          projectId,
          { observations: batch },
        );
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
        await this._send(batch.slice(0, middle));
        await this._send(batch.slice(middle));
        return;
      }
      if (status === 402) {
        this._reportOnce(
          "usage",
          "Observations are not stored: the organization is over its ingestion usage limit",
        );
        return;
      }
      if (status === 404) {
        this._reportOnce(
          "disabled",
          "Observations are not stored: conversations are not enabled for this organization",
        );
        return;
      }
      const retryable = status === undefined || RETRYABLE_STATUSES.has(status);
      if (!retryable || attempt === MAX_ATTEMPTS) {
        Logger.error(
          `[Conversations] Dropped ${batch.length} observations: ${status ?? "network error"} ${detail}`,
        );
        return;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, (retryAfterSeconds || 2 ** (attempt - 1)) * 1000),
      );
    }
  }

  private _reportOnce(reason: string, message: string): void {
    if (this._reported.has(reason)) return;
    this._reported.add(reason);
    Logger.warn(`[Conversations] ${message}`);
  }
}
