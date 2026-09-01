/**
 * Adapted from p-limit (https://github.com/sindresorhus/p-limit),
 * MIT © Sindre Sorhus. Trimmed to an array queue: no AsyncResource,
 * no concurrency getters, no map helper.
 */

export type LimitFunction = <T>(fn: () => T | Promise<T>) => Promise<T>;

/** Return a function that runs at most `concurrency` calls at a time. */
export function pLimit(concurrency: number): LimitFunction {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError("Expected `concurrency` to be an integer >= 1");
  }

  const queue: Array<() => void> = [];
  let activeCount = 0;

  const next = (): void => {
    activeCount -= 1;
    const resume = queue.shift();
    if (resume) {
      // Claim the slot before the waiter resumes so a new caller arriving
      // in between cannot over-admit past the limit.
      activeCount += 1;
      resume();
    }
  };

  return async <T>(fn: () => T | Promise<T>): Promise<T> => {
    if (activeCount < concurrency) {
      activeCount += 1;
    } else {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    try {
      return await fn();
    } finally {
      next();
    }
  };
}
