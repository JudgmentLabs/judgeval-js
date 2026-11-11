import { Logger } from "../../utils/logger";
import { JudgmentApiClient } from "../../internal/api/client";
import type { RequestBody } from "../../internal/api/models";

type IngestRequest = RequestBody<"/v1/projects/{projectId}/mcp/calls", "post">;
export type McpCall = IngestRequest["calls"][number];

interface Destination {
  apiUrl: string;
  apiKey: string;
  organizationId: string;
  projectId: string;
}

const MAX_QUEUE = 1_000;
const MAX_QUEUE_BYTES = 8 * 1024 * 1024;
const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 1_000;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 3;
const FLUSH_TIMEOUT_MS = 30_000;

/** Owns delivery only: records are serialized once, before entering the queue. */
export class McpCallExporter {
  private queue: string[] = [];
  private queuedBytes = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: Promise<void>;
  private closed = false;
  private batch?: { body: string; attempts: number; retryAt: number };
  private readonly client: JudgmentApiClient;

  constructor(private readonly destination: Destination) {
    this.client = new JudgmentApiClient(
      destination.apiUrl,
      destination.apiKey,
      destination.organizationId,
    );
  }

  enqueue(call: McpCall): void {
    const serialized = JSON.stringify(call);
    const bytes = Buffer.byteLength(serialized);
    if (
      this.closed ||
      this.queue.length >= MAX_QUEUE ||
      this.queuedBytes + bytes > MAX_QUEUE_BYTES
    ) {
      Logger.warning("MCP export queue unavailable; dropping call");
      return;
    }
    this.queue.push(serialized);
    this.queuedBytes += bytes;
    this.schedule();
  }

  async forceFlush(): Promise<void> {
    const deadline = performance.now() + FLUSH_TIMEOUT_MS;
    clearTimeout(this.timer);
    this.timer = undefined;
    while (this.pending !== undefined) await this.pending;
    this.pending = this.send(this.queue.length, deadline);
    try {
      await this.pending;
    } finally {
      this.pending = undefined;
      this.schedule();
    }
  }

  async shutdown(): Promise<void> {
    this.closed = true;
    await this.forceFlush();
  }

  private schedule(): void {
    if (
      this.closed ||
      this.timer !== undefined ||
      (this.queue.length === 0 && this.batch === undefined)
    )
      return;
    const delay = Math.max(
      FLUSH_INTERVAL_MS,
      (this.batch?.retryAt ?? 0) - Date.now(),
    );
    this.timer = setTimeout(
      () => void this.forceFlush(),
      Math.min(delay, 2_147_483_647),
    );
    this.timer.unref();
  }

  private async send(remainingCalls: number, deadline: number): Promise<void> {
    while (
      (remainingCalls > 0 || this.batch !== undefined) &&
      performance.now() < deadline
    ) {
      if (this.batch === undefined) {
        const calls = this.queue.splice(
          0,
          Math.min(BATCH_SIZE, remainingCalls),
        );
        remainingCalls -= calls.length;
        this.queuedBytes -= calls.reduce(
          (total, call) => total + Buffer.byteLength(call),
          0,
        );
        this.batch = {
          body: `{"calls":[${calls.join(",")}]}`,
          attempts: 0,
          retryAt: 0,
        };
      }
      if (!(await this.sendBatch(this.batch, deadline))) return;
      this.batch = undefined;
    }
  }

  private async sendBatch(
    batch: { body: string; attempts: number; retryAt: number },
    deadline: number,
  ): Promise<boolean> {
    while (batch.attempts < MAX_ATTEMPTS) {
      const delay = Math.max(0, batch.retryAt - Date.now());
      if (performance.now() + delay >= deadline) return false;
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      const remaining = deadline - performance.now();
      if (remaining <= 0) return false;
      batch.attempts++;
      let retryAfter = 0;
      try {
        const response = await this.client.postV1projectsMcpCalls(
          this.destination.projectId,
          JSON.parse(batch.body) as IngestRequest,
          {
            bodySerializer: () => batch.body,
            signal: AbortSignal.timeout(
              Math.ceil(Math.min(REQUEST_TIMEOUT_MS, remaining)),
            ),
          },
        );
        if (response.ok) return true;
        if (
          response.status !== 408 &&
          response.status !== 429 &&
          response.status < 500
        )
          break;
        retryAfter = retryDelay(response.headers.get("Retry-After"));
      } catch {
        // Network failures retry the exact same immutable batch.
      }
      batch.retryAt =
        Date.now() + Math.max(retryAfter, 250 * 2 ** (batch.attempts - 1));
    }
    Logger.warning("MCP export failed; dropping batch");
    return true;
  }
}

function retryDelay(value: string | null): number {
  if (value === null) return 0;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds)
    ? seconds * 1_000
    : Date.parse(value) - Date.now();
  return Number.isFinite(delay) ? Math.max(0, delay) : 0;
}

/** Redact a detached snapshot; failures and oversized payloads omit the field. */
export function capturePayload(
  value: unknown,
  field: "input" | "output",
  redact?: (value: unknown, field: "input" | "output") => unknown,
): unknown {
  try {
    const snapshot: unknown = JSON.parse(JSON.stringify(value, finiteNumbers));
    const serialized = JSON.stringify(
      redact === undefined ? snapshot : redact(snapshot, field),
      finiteNumbers,
    );
    if (serialized === undefined || Buffer.byteLength(serialized) > 128 * 1024)
      return undefined;
    return JSON.parse(serialized) as unknown;
  } catch {
    return undefined;
  }
}

function finiteNumbers(_key: string, value: unknown): unknown {
  if (typeof value === "number" && !Number.isFinite(value))
    throw new TypeError("Non-finite payload");
  return value;
}
