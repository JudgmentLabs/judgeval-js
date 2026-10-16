import { Logger } from "../utils/logger";

/** Shown by the deprecated offline-test APIs. */
export const OFFLINE_TESTS_DEPRECATION =
  "Offline tests and OfflineTracer are deprecated. Use judgeval.tests and " +
  "judgeval.testRuns, and tag your normal Tracer's traces with Tracer.testCase.";

let warnedOfflineTests = false;

/** Logs the offline-tests deprecation once per process. */
export function warnOfflineTestsDeprecated(): void {
  if (warnedOfflineTests) return;
  warnedOfflineTests = true;
  Logger.warning(OFFLINE_TESTS_DEPRECATION);
}
