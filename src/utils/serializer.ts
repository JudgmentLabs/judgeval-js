import { Logger } from "./logger";

export type Serializer = (obj: unknown) => string;

function replacer(this: unknown, _key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object" && value !== null) {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
  }
  return value;
}

let seen: WeakSet<object>;

export function safeStringify(obj: unknown): string {
  try {
    seen = new WeakSet<object>();
    const result = JSON.stringify(obj, replacer);
    return typeof result === "string" ? result : String(obj);
  } catch (e) {
    Logger.error(`safeStringify failed: ${e}`);
    return String(obj);
  }
}
