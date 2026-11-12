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
