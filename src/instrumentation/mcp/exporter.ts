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
const WARNING_INTERVAL_MS = 60_000;

/** Owns delivery only: records are serialized once, before entering the queue. */
export class McpCallExporter {
  private queue: string[] = [];
  private queuedBytes = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: Promise<void>;
  private closed = false;
  private nextWarning = 0;
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
    if (this.closed) return;
    const serialized = JSON.stringify(call, finiteNumbers);
    if (!validCall(JSON.parse(serialized) as McpCall)) {
      this.warn("Invalid MCP event; dropping call");
      return;
    }
    const bytes = Buffer.byteLength(serialized);
    if (
      this.queue.length >= MAX_QUEUE ||
      this.queuedBytes + bytes > MAX_QUEUE_BYTES
    ) {
      this.warn("MCP export queue unavailable; dropping call");
      return;
    }
    this.queue.push(serialized);
    this.queuedBytes += bytes;
    this.schedule();
  }

  get isClosed(): boolean {
    return this.closed;
  }

  private warn(message: string): void {
    const now = performance.now();
    if (now < this.nextWarning) return;
    this.nextWarning = now + WARNING_INTERVAL_MS;
    Logger.warning(message);
  }

  async forceFlush(): Promise<void> {
    // An explicit flush keeps deferred retries alive until its deadline.
    const keepAlive = setTimeout(() => {}, FLUSH_TIMEOUT_MS);
    try {
      await this.flush();
    } finally {
      clearTimeout(keepAlive);
    }
  }

  private async flush(): Promise<void> {
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
      () => void this.flush(),
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
      if (delay > 0)
        await new Promise((resolve) => setTimeout(resolve, delay).unref());
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
    this.warn("MCP export failed; dropping batch");
    return true;
  }
}

const STRING_LIMITS: Record<string, readonly [number, number]> = {
  call_id: [1, 512],
  session_id: [1, 512],
  user_id: [1, 512],
  server_name: [1, 256],
  tool_name: [1, 256],
  client_name: [1, 256],
  environment_name: [1, 256],
  model: [1, 256],
  error_type: [1, 256],
  intent: [0, 2048],
  error_message: [0, 8192],
  trace_id: [0, 512],
  span_id: [0, 512],
};

/** Rejects individual malformed events before they can poison a delivery batch. */
function validCall(call: McpCall): boolean {
  const required = [
    "call_id",
    "timestamp",
    "duration_ms",
    "outcome",
    "server_name",
    "tool_name",
  ];
  if (
    required.some((key) => !(key in call)) ||
    typeof call.timestamp !== "string"
  )
    return false;
  if (
    Object.entries(call).some(([key, value]) => {
      const limit = Object.prototype.hasOwnProperty.call(STRING_LIMITS, key)
        ? STRING_LIMITS[key]
        : undefined;
      if (limit !== undefined)
        return (
          typeof value !== "string" ||
          value.length < limit[0] ||
          value.length > limit[1]
        );
      return ![
        "timestamp",
        "duration_ms",
        "outcome",
        "argument_keys",
        "input",
        "output",
        "metadata",
      ].includes(key);
    })
  )
    return false;
  const timestamp = Date.parse(call.timestamp);
  const date = call.timestamp.slice(0, 10);
  const calendarDate = new Date(`${date}T00:00:00Z`);
  return (
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(
      call.timestamp,
    ) &&
    timestamp >= 0 &&
    timestamp < Date.UTC(2100, 0, 1) &&
    Number.isFinite(calendarDate.getTime()) &&
    calendarDate.toISOString().startsWith(date) &&
    typeof call.duration_ms === "number" &&
    Number.isFinite(call.duration_ms) &&
    call.duration_ms >= 0 &&
    ["success", "error", "cancelled"].includes(call.outcome) &&
    (call.argument_keys === undefined ||
      (Array.isArray(call.argument_keys) &&
        call.argument_keys.length <= 100 &&
        call.argument_keys.every(
          (key) =>
            typeof key === "string" && key.length > 0 && key.length <= 256,
        ))) &&
    [call.input, call.output].every(
      (value) =>
        value === undefined ||
        Buffer.byteLength(JSON.stringify(value)) <= 128 * 1024,
    ) &&
    (call.metadata === undefined ||
      (call.metadata !== null &&
        typeof call.metadata === "object" &&
        !Array.isArray(call.metadata) &&
        Buffer.byteLength(JSON.stringify(call.metadata)) <= 16 * 1024))
  );
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
