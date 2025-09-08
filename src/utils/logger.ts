/**
 * Simple logger utility for the Judgment tracer.
 */
export class Logger {
  public static error(message: string): void {
    console.error(`[JudgmentTracer] ERROR: ${message}`);
  }

  public static info(message: string): void {
    console.log(`[JudgmentTracer] INFO: ${message}`);
  }

  public static warn(message: string): void {
    console.warn(`[JudgmentTracer] WARN: ${message}`);
  }

  public static debug(message: string): void {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[JudgmentTracer] DEBUG: ${message}`);
    }
  }
}
