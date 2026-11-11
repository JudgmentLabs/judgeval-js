import { Logger } from "../../utils/logger";

export interface McpCall {
  call_id: string;
  session_id?: string;
  timestamp: string;
  duration_ms: number;
  outcome: "success" | "error" | "cancelled";
  server_name: string;
  tool_name: string;
  environment_name?: string;
  client_name?: string;
  user_id?: string;
  intent?: string;
  model?: string;
  argument_keys: string[];
  error_type?: string;
  error_message?: string;
  input?: unknown;
  output?: unknown;
  trace_id?: string;
  span_id?: string;
  metadata: Record<string, unknown>;
}

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

  constructor(private readonly destination: Destination) {}

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
    if (this.timer === undefined) {
      this.timer = setTimeout(() => void this.forceFlush(), FLUSH_INTERVAL_MS);
      this.timer.unref();
    }
  }

  async forceFlush(): Promise<void> {
    const deadline = performance.now() + FLUSH_TIMEOUT_MS;
    clearTimeout(this.timer);
    this.timer = undefined;
    while (this.pending !== undefined) await this.pending;
    if (this.queue.length === 0) return;
    // Snapshot the current queue so a busy producer cannot prevent a flush ending.
    const calls = this.queue.splice(0);
    this.queuedBytes = 0;
    this.pending = this.send(calls, deadline);
    try {
      await this.pending;
    } finally {
      this.pending = undefined;
    }
  }

  async shutdown(): Promise<void> {
    this.closed = true;
    await this.forceFlush();
  }

  private async send(calls: string[], deadline: number): Promise<void> {
    for (let offset = 0; offset < calls.length; offset += BATCH_SIZE) {
      const body = `{"calls":[${calls.slice(offset, offset + BATCH_SIZE).join(",")}]}`;
      await this.sendBatch(body, deadline);
    }
  }

  private async sendBatch(body: string, deadline: number): Promise<void> {
    const { apiUrl, apiKey, organizationId, projectId } = this.destination;
    const url = `${apiUrl.replace(/\/$/, "")}/v1/projects/${encodeURIComponent(projectId)}/mcp/calls`;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const remaining = deadline - performance.now();
      if (remaining <= 0) break;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "X-Organization-Id": organizationId,
          },
          body,
          signal: AbortSignal.timeout(
            Math.ceil(Math.min(REQUEST_TIMEOUT_MS, remaining)),
          ),
        });
        await response.body?.cancel();
        if (response.ok) return;
        if (
          response.status !== 408 &&
          response.status !== 429 &&
          response.status < 500
        )
          break;
      } catch {
        // Network failures retry the exact same immutable batch.
      }
      if (attempt + 1 < MAX_ATTEMPTS)
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
    Logger.warning("MCP export failed; dropping batch");
  }
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
