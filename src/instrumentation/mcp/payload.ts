const MAX_PAYLOAD_BYTES = 128 * 1024;

/** Redact a detached snapshot; failures and oversized payloads omit the field. */
export function capturePayload(
  value: unknown,
  field: "input" | "output",
  redact?: (value: unknown, field: "input" | "output") => unknown,
): unknown {
  try {
    const snapshot = boundedSnapshot(value);
    return redact === undefined
      ? snapshot
      : boundedSnapshot(redact(snapshot, field));
  } catch {
    return undefined;
  }
}

function boundedSnapshot(value: unknown): unknown {
  remainingBudget(value, MAX_PAYLOAD_BYTES);
  const serialized = JSON.stringify(value, finiteNumbers);
  if (
    serialized === undefined ||
    Buffer.byteLength(serialized) > MAX_PAYLOAD_BYTES
  )
    throw new Error("MCP payload exceeds capture limit");
  return JSON.parse(serialized) as unknown;
}

/** Bound traversal and source strings before JSON allocates the snapshot. */
function remainingBudget(value: unknown, budget: number): number {
  let remaining = budget - 1;
  if (remaining < 0) throw new Error("MCP payload exceeds capture limit");
  if (typeof value === "string") remaining -= value.length;
  else if (Array.isArray(value)) {
    for (const item of value) remaining = remainingBudget(item, remaining);
  } else if (typeof value === "object" && value !== null) {
    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      remaining = remainingBudget(key, remaining);
      remaining = remainingBudget(Reflect.get(value, key), remaining);
    }
  }
  if (remaining < 0) throw new Error("MCP payload exceeds capture limit");
  return remaining;
}

function finiteNumbers(_key: string, value: unknown): unknown {
  if (typeof value === "number" && !Number.isFinite(value))
    throw new TypeError("Non-finite payload");
  return value;
}
