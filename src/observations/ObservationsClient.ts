import type { JudgmentApiClient } from "../internal/api/client";
import type { Observation, RequestBody } from "../internal/api/models";
import { dontThrow } from "../utils/dont-throw";
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

/** Options for {@link ObservationsClient.record}. */
export interface RecordObservationOptions {
  /**
   * When the call completed; defaults to now. Two identical calls at
   * different times are two calls.
   */
  observedAt?: Date;
  /**
   * The deployment environment the call ran in, such as `"production"`;
   * judges can be limited to environments.
   */
  environment?: string;
}

/**
 * Sends observations to Judgment without traces.
 *
 * `record` returns at once and never throws: observations are queued and
 * sent in the background, in batches. Each one is stored in its conversation
 * and evaluated by the project's conversation judges, as model calls recorded
 * from traces are. Await `flush()` before a short-lived process or serverless
 * handler ends; in Node, queued observations are also sent before the
 * process exits.
 *
 * Access via `client.observations`.
 *
 * @example
 * ```typescript
 * client.observations.record(
 *   {
 *     conversation_id: "ticket-4812",
 *     model: "my-model-v2",
 *     input: [{ type: "message", role: "user", content: [{ type: "text", text: "Where is my order?" }] }],
 *     output: [{ type: "message", role: "assistant", content: [{ type: "text", text: "It ships today." }] }],
 *   },
 *   { environment: "production" },
 * );
 * await client.observations.flush();
 * ```
 */
export class ObservationsClient {
  private readonly _client: JudgmentApiClient;
  private readonly _projectId: string | null;
  private readonly _queue: SentObservation[] = [];
  private readonly _reported = new Set<string>();
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _sending: Promise<void> | undefined;
  private _exitHookRegistered = false;
  private _shutdown = false;

  constructor(client: JudgmentApiClient, projectId: string | null) {
    this._client = client;
    this._projectId = projectId;
  }

  /**
   * Queue one model call to be sent to Judgment.
   *
   * @param observation - The call, in the conversation format: its
   *   `conversation_id`, `input` (everything the model was given, including
   *   history from earlier calls), and optionally its `output`, `tools`,
   *   `model`, `usage`, and more.
   * @param options - When the call was observed, and its environment.
   */
  record(
    observation: Observation,
    options: RecordObservationOptions = {},
  ): void {
    dontThrow("ObservationsClient.record", () => {
      if (this._projectId === null) {
        this._reportOnce(
          "project",
          "Observations are not sent: the project was not found",
        );
        return;
      }
      if (this._shutdown) return;
      if (this._queue.length >= MAX_QUEUE_SIZE) {
        this._reportOnce(
          "full",
          `Observation queue is full (${MAX_QUEUE_SIZE}); dropping observations until it drains`,
        );
        return;
      }
      this._queue.push({
        // Sent later, so copy it: changes the caller makes afterwards, such
        // as appending to a shared message history, are not sent.
        observation: structuredClone(observation),
        observed_at: (options.observedAt ?? new Date()).toISOString(),
        environment: options.environment,
      });
      this._registerExitHook();
      if (this._queue.length >= MAX_BATCH_SIZE) void this._drain();
      this._scheduleDrain();
    });
  }

  /**
   * Send every queued observation now.
   *
   * @returns Resolves once every queued observation was sent or dropped;
   *   never rejects.
   */
  async flush(): Promise<void> {
    clearTimeout(this._timer);
    this._timer = undefined;
    await this._drain();
  }

  /**
   * Send queued observations, then stop sending. Observations recorded
   * afterwards are ignored.
   */
  async shutdown(): Promise<void> {
    await this.flush();
    this._shutdown = true;
  }

  private _scheduleDrain(): void {
    if (this._timer !== undefined) return;
    this._timer = setTimeout(() => {
      this._timer = undefined;
      void this._drain();
    }, FLUSH_INTERVAL_MS);
    // Waiting to fill a batch must not keep the process alive; the exit hook
    // sends what is left.
    this._timer.unref();
  }

  private _registerExitHook(): void {
    if (this._exitHookRegistered || typeof process === "undefined") return;
    this._exitHookRegistered = true;
    // Work started here keeps the process alive until it is done.
    process.on("beforeExit", () => {
      if (this._queue.length > 0) void this.flush();
    });
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
          `[Observations] Dropped ${batch.length} observations: ${String(error)}`,
        );
      }
    }
  }

  private async _send(batch: SentObservation[]): Promise<void> {
    const projectId = this._projectId;
    if (projectId === null) return;
    for (let attempt = 1; ; attempt++) {
      let status: number | undefined;
      let retryAfterSeconds = 0;
      let detail: string;
      try {
        const { response, error } =
          await this._client.postV1projectsObservations(projectId, {
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
          `[Observations] Dropped ${batch.length} observations: ${status ?? "network error"} ${detail}`,
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
    Logger.warn(`[Observations] ${message}`);
  }
}
