import { context } from "@opentelemetry/api";
import {
  BindOnceFuture,
  suppressTracing,
  unrefTimer,
} from "@opentelemetry/core";
import { runWithOtelBridgeGate } from "../trace/instrumentation/OtelContextBridge";
import { Logger } from "../utils/logger";
import type {
  ObservationExporter,
  SentObservation,
} from "./ObservationExporter";

/** The most observations the server accepts in one request. */
const MAX_EXPORT_BATCH_SIZE = 100;
// The span processors' defaults (OpenTelemetry's), so observations and spans
// are held and sent alike.
const MAX_QUEUE_SIZE = 2048;
const SCHEDULED_DELAY_MILLIS = 5000;
const EXPORT_TIMEOUT_MILLIS = 30000;

/**
 * Queues observations and exports them in batches.
 *
 * Modeled on OpenTelemetry's `BatchSpanProcessorBase`: a full queue drops new
 * observations, a batch is exported every `SCHEDULED_DELAY_MILLIS` or as soon
 * as one fills, one batch is in flight at a time, the wait for a batch does
 * not keep the process alive, and `shutdown` runs once.
 */
export class BatchObservationProcessor {
  private readonly _exporter: ObservationExporter;
  private readonly _shutdownOnce: BindOnceFuture<void>;
  private _queue: SentObservation[] = [];
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _isExporting = false;
  private _exporting: Promise<void> = Promise.resolve();
  private _droppedCount = 0;

  constructor(exporter: ObservationExporter) {
    this._exporter = exporter;
    this._shutdownOnce = new BindOnceFuture(this._flushAll, this);
  }

  emit(observation: SentObservation): void {
    if (this._shutdownOnce.isCalled) return;
    if (this._queue.length >= MAX_QUEUE_SIZE) {
      if (this._droppedCount === 0) {
        Logger.warn("[Trajectory] Queue full, dropping observations");
      }
      this._droppedCount++;
      return;
    }
    if (this._droppedCount > 0) {
      Logger.warn(
        `[Trajectory] Dropped ${this._droppedCount} observations because the queue was full`,
      );
      this._droppedCount = 0;
    }
    this._queue.push(observation);
    this._maybeStartTimer();
  }

  /** Exports every queued observation; never rejects. */
  forceFlush(): Promise<void> {
    if (this._shutdownOnce.isCalled) return this._shutdownOnce.promise;
    return this._flushAll();
  }

  /** Exports the queue, then ignores new observations; never rejects. */
  shutdown(): Promise<void> {
    return this._shutdownOnce.call();
  }

  private async _flushAll(): Promise<void> {
    // A batch the timer already took off the queue counts as queued.
    await this._exporting;
    const batches = Math.ceil(this._queue.length / MAX_EXPORT_BATCH_SIZE);
    await Promise.all(
      Array.from({ length: batches }, () => this._flushOneBatch()),
    );
  }

  private async _flushOneBatch(): Promise<void> {
    this._clearTimer();
    if (this._queue.length === 0) return;
    const batch = this._queue.splice(0, MAX_EXPORT_BATCH_SIZE);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    // The export's own HTTP request must not be recorded as a span of the
    // user's app.
    // This SDK's tracer keeps its own context, which reaches OpenTelemetry
    // only through the bridge.
    const suppressed = suppressTracing(context.active());
    await context.with(suppressed, () =>
      runWithOtelBridgeGate(suppressed, () =>
        Promise.race([
          this._exporter.export(batch),
          new Promise<void>((resolve) => {
            timeout = setTimeout(() => {
              Logger.error(
                `[Trajectory] Exporting ${batch.length} observations timed out`,
              );
              resolve();
            }, EXPORT_TIMEOUT_MILLIS);
          }),
        ]).finally(() => clearTimeout(timeout)),
      ),
    );
  }

  private _maybeStartTimer(): void {
    if (this._isExporting) return;
    const flush = () => {
      this._isExporting = true;
      this._exporting = this._flushOneBatch().finally(() => {
        this._isExporting = false;
        if (this._queue.length > 0) {
          this._clearTimer();
          this._maybeStartTimer();
        }
      });
    };
    if (this._queue.length >= MAX_EXPORT_BATCH_SIZE) {
      flush();
      return;
    }
    if (this._timer !== undefined) return;
    this._timer = setTimeout(flush, SCHEDULED_DELAY_MILLIS);
    unrefTimer(this._timer);
  }

  private _clearTimer(): void {
    if (this._timer !== undefined) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
  }
}
