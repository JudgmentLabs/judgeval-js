import { Logger } from "../utils/logger";

/** Shown by the deprecated OfflineTracer. */
export const OFFLINE_TRACER_DEPRECATION =
  "OfflineTracer is deprecated. Use judgeval.testSuites and judgeval.testRuns, " +
  "and tag your normal Tracer's traces with Tracer.testCase.";

let warned = false;

/** Logs the OfflineTracer deprecation once per process. */
export function warnOfflineTracerDeprecated(): void {
  if (warned) return;
  warned = true;
  Logger.warning(OFFLINE_TRACER_DEPRECATION);
}
