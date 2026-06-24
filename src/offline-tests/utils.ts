import pc from "picocolors";
import type {
  JudgeVersionPin,
  OfflineExampleResult,
  OfflineScorerData,
  OfflineTestResult,
  PassConditionFn,
} from "./types";

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function binaryLabel(value: boolean): string {
  return value ? "Yes" : "No";
}

/** Extract a scorer's display value: "Yes"/"No" for binary, the string for
 *  categorical, the number for numeric. */
export function scorerValue(
  scorer: Record<string, unknown>,
): string | number | null {
  const scoreType = scorer.score_type;
  const bool = scorer.bool_value;
  const str = scorer.str_value;
  const num = scorer.num_value;
  if (scoreType === "binary") {
    return typeof bool === "boolean" ? binaryLabel(bool) : null;
  }
  if (scoreType === "categorical") {
    return typeof str === "string" ? str : null;
  }
  if (scoreType === "numeric") {
    return typeof num === "number" ? num : null;
  }
  if (typeof bool === "boolean") return binaryLabel(bool);
  if (typeof str === "string") return str;
  if (typeof num === "number") return num;
  return null;
}

function reasonText(raw: unknown): string | null {
  if (typeof raw === "object" && raw !== null) {
    const text = (raw as Record<string, unknown>).text;
    return typeof text === "string" && text ? text : null;
  }
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        const text = (parsed as Record<string, unknown>).text;
        if (typeof text === "string") return text || null;
      }
    } catch {
      // not JSON; fall through to the raw string
    }
    return raw || null;
  }
  return null;
}

/** Validate `judgeVersions` and normalize each pin to the server's snake_case shape. */
export function normalizeJudgeVersions(
  pins?: JudgeVersionPin[],
): Record<string, unknown>[] | undefined {
  if (!pins || pins.length === 0) return undefined;
  const out: Record<string, unknown>[] = [];
  for (const pin of pins) {
    if (!pin.name && !pin.judgeId) {
      throw new Error(
        "judgeVersions entries require a 'name' (or 'judgeId') key",
      );
    }
    const entry: Record<string, unknown> = {};
    if (pin.judgeId !== undefined) entry.judge_id = pin.judgeId;
    if (pin.name !== undefined) entry.name = pin.name;
    if (pin.tag !== undefined) entry.tag = pin.tag;
    if (pin.version !== undefined) entry.version = pin.version;
    if (pin.majorVersion !== undefined) entry.major_version = pin.majorVersion;
    if (pin.minorVersion !== undefined) entry.minor_version = pin.minorVersion;
    out.push(entry);
  }
  return out;
}

/** Turn raw test-run item rows into per-example results, applying the optional
 *  pass condition to each row (its outcome is stored as every scorer's success). */
export function buildResults(
  items: Record<string, unknown>[],
  agentTraces: Record<string, string>,
  passConditionFn?: PassConditionFn,
): OfflineExampleResult[] {
  const results: OfflineExampleResult[] = [];
  for (const item of items) {
    const exampleId = asString(item.example_id);
    const data = asRecord(item.data);

    const scorers: OfflineScorerData[] = [];
    for (const raw of asArray(item.scorers)) {
      const scorer = asRecord(raw);
      const metadata: Record<string, unknown> = {
        judge_id: scorer.judge_id,
        judge_major_version: scorer.judge_major_version,
        judge_minor_version: scorer.judge_minor_version,
      };
      const reason = reasonText(scorer.reason);
      if (reason) metadata.reason = reason;
      scorers.push({
        name: asString(scorer.judge_name),
        value: scorerValue(scorer),
        scoreType:
          typeof scorer.score_type === "string" ? scorer.score_type : null,
        error: typeof scorer.error === "string" ? scorer.error : null,
        success: typeof scorer.success === "boolean" ? scorer.success : null,
        metadata,
      });
    }

    if (passConditionFn) {
      const passed = Boolean(passConditionFn({ ...data }, scorers));
      for (const scorer of scorers) scorer.success = passed;
    }

    results.push({
      exampleId,
      data,
      scorers,
      agentOfflineTraceId: agentTraces[exampleId],
    });
  }
  return results;
}

/** Throw if the run did not complete or any example failed its pass condition. */
export function assertAllPassed(outcome: OfflineTestResult): void {
  if (outcome.status !== "completed") {
    throw new Error(
      `Test run ${outcome.testRunId} finished with status '${outcome.status}'`,
    );
  }
  const failed = outcome.results
    .filter((result) =>
      result.scorers.some((scorer) => scorer.success === false),
    )
    .map((result) => result.exampleId);
  if (failed.length > 0 || outcome.passed !== true) {
    throw new Error(
      `Test run ${outcome.testRunId} failed its pass condition for ${failed.length} example(s): ${JSON.stringify(failed)}`,
    );
  }
}

/** Print a header for a starting run. */
export function displayStart(
  configName: string,
  projectName: string,
  exampleCount: number,
): void {
  console.log();
  console.log(pc.bold(pc.cyan("Starting Offline Test")));
  console.log(`${pc.dim("Config:")} ${configName}`);
  console.log(`${pc.dim("Project:")} ${projectName}`);
  console.log(`${pc.dim("Examples:")} ${exampleCount}`);
  console.log();
}

/** Print per-example results and the results link. */
export function displayResults(
  results: OfflineExampleResult[],
  uiResultsUrl: string | undefined,
): void {
  console.log();
  results.forEach((result, i) => {
    const hasVerdict = result.scorers.some(
      (s) => s.success !== null && s.success !== undefined,
    );
    if (hasVerdict) {
      const passed = result.scorers.every((s) => s.success === true);
      console.log(
        passed
          ? `${pc.green("✓")} Example ${i + 1}: ${pc.green("PASSED")}`
          : `${pc.red("✗")} Example ${i + 1}: ${pc.red("FAILED")}`,
      );
    } else {
      console.log(`${pc.cyan("•")} Example ${i + 1}:`);
    }
    for (const s of result.scorers) {
      if (s.error) {
        console.log(`  ${pc.dim(`${s.name}:`)} ${pc.red(`error: ${s.error}`)}`);
        continue;
      }
      const valueStr = s.value === null ? "N/A" : String(s.value);
      const colored =
        s.success === true
          ? pc.green(valueStr)
          : s.success === false
            ? pc.red(valueStr)
            : valueStr;
      console.log(`  ${pc.dim(`${s.name}:`)} ${colored}`);
    }
  });
  console.log();
  if (uiResultsUrl) {
    console.log(
      `${pc.dim("View full details:")} ${pc.underline(uiResultsUrl)}`,
    );
    console.log();
  }
}
