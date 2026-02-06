import type { RetryConfig } from "./types.js";

/**
 * Adds jitter to a delay value (±20% randomization)
 * @param delayMs - Base delay in milliseconds
 * @returns Delay with jitter applied
 */
function addJitter(delayMs: number): number {
  const jitterRange = delayMs * 0.2;
  const jitter = Math.random() * jitterRange * 2 - jitterRange;
  return Math.max(0, delayMs + jitter);
}

/**
 * Calculates exponential backoff delay
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay cap
 * @returns Delay in milliseconds with jitter
 */
function calculateBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exponentialDelay = baseDelayMs * 2 ** attempt;
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  return addJitter(cappedDelay);
}

/**
 * Executes a function with retry logic and exponential backoff
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns Result of the function or undefined if all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T | undefined> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if we've exhausted attempts
      if (attempt === config.maxRetries) {
        break;
      }

      // Calculate backoff delay
      const delayMs = calculateBackoff(
        attempt,
        config.baseDelayMs,
        config.maxDelayMs
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // All retries exhausted - fail open
  console.warn(
    "[tollgate-sdk] All retry attempts exhausted. Last error:",
    lastError
  );
  return undefined;
}
