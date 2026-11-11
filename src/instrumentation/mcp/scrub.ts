import { scrubIdentifiers } from "./agent-arguments";

/** Snapshot bounded string arguments before a handler can mutate them. */
export function argumentValues(
  params: { readonly arguments?: unknown; readonly uri?: unknown } | undefined,
): string[] {
  const pending: unknown[] = [params?.arguments, params?.uri];
  const found = new Set<string>();
  for (let visited = 0; pending.length > 0 && visited < 1_000; visited++) {
    const value = pending.pop();
    if (typeof value === "string" && value.length >= 4) {
      found.add(value);
      found.add(JSON.stringify(value).slice(1, -1));
      if (found.size >= 100) break;
    } else if (value !== null && typeof value === "object") {
      pending.push(...Object.values(value).slice(0, 1_000 - pending.length));
    }
  }
  return [...found].sort((a, b) => b.length - a.length);
}

/** Error messages can echo input even when payload capture is disabled. */
export function scrubErrorMessage(
  message: string,
  values: readonly string[],
): string {
  let text = message.slice(0, 100_000);
  const echoed = values.filter((value) => text.includes(value));
  if (echoed.length > 0) {
    const patterns = echoed.map((value) => {
      const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return `${/^\w/.test(value) ? "(?<!\\w)" : ""}${escaped}${/\w$/.test(value) ? "(?!\\w)" : ""}`;
    });
    text = text.replace(new RegExp(patterns.join("|"), "g"), "[argument]");
  }
  return scrubIdentifiers(
    text
      .slice(0, 4_000)
      .replace(
        /input_value=[^\n]*?(?=, input_type=|\n|$)/g,
        "input_value=[argument]",
      ),
  );
}
