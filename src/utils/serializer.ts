import { Logger } from "./logger";

export type Serializer = (obj: unknown) => string;

let seen: WeakSet<object>;

function safeReplacer(this: unknown, _key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object" && value !== null) {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
  }
  return value;
}

export function safeStringify(obj: unknown): string {
  try {
    const result = JSON.stringify(obj);
    if (typeof result === "string") return result;
    return String(result);
  } catch {
    try {
      seen = new WeakSet<object>();
      const result = JSON.stringify(obj, safeReplacer);
      return typeof result === "string" ? result : String(obj);
    } catch (e) {
      Logger.error(`safeStringify failed: ${e}`);
      return String(obj);
    }
  }
}
