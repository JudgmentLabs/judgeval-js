export interface RetryConfig {
  /** Maximum number of attempts. Defaults to `3`. */
  maxRetries?: number;
  /**
   * Function that returns the backoff delay in milliseconds for the
   * given attempt. The first call receives `iteration = 1`.
   * Defaults to a flat 1000 ms.
   */
  backoff?: (iteration: number) => number;
  /** Called after each failed attempt, before sleeping for the backoff. */
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Retry a function up to a maximum number of times with configurable
 * backoff.
 *
 * @param fn - The function to retry.
 * @param config - Retry configuration.
 *   - `maxRetries` — maximum number of attempts (default: 3).
 *   - `backoff` — delay in ms between attempts (default: flat 1000 ms).
 *   - `onRetry` — invoked with `(attempt, error)` after each failed
 *     attempt (default: no-op).
 * @returns The resolved value of `fn`.
 * @throws The last error raised by `fn` if it fails on every attempt.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
): Promise<T> {
  const { maxRetries = 3, backoff = () => 1000, onRetry } = config;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      onRetry?.(attempt, error);
      await new Promise((resolve) => setTimeout(resolve, backoff(attempt)));
    }
  }

  // Unreachable: the loop always either returns or throws.
  throw new Error("retry: exhausted all attempts");
}
