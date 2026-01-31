/**
 * High-resolution timer for measuring request latency
 */
export interface Timer {
  /** Returns elapsed time in milliseconds since timer creation */
  elapsed(): number;
}

/**
 * Creates a high-resolution timer
 * Uses performance.now() for sub-millisecond precision when available
 * @returns Timer instance
 */
export function createTimer(): Timer {
  const startTime = performance.now();

  return {
    elapsed(): number {
      return performance.now() - startTime;
    },
  };
}

/**
 * Gets the current timestamp in ISO 8601 format
 * @returns ISO 8601 timestamp string
 */
export function getTimestamp(): string {
  return new Date().toISOString();
}
