import type { TransportConfig } from "../core/config.js";
import type { AnalyticsEvent } from "../events/schema.js";
import { withRetry } from "./retry.js";
import type { TransportResult } from "./types.js";

/**
 * Sends a batch of events to the analytics endpoint
 * @param events - Array of analytics events to send
 * @param config - Transport configuration
 * @param apiKey - API key for authentication
 * @param endpoint - Analytics endpoint URL
 * @returns Transport result with success status
 */
export async function sendBatch(
  events: AnalyticsEvent[],
  config: TransportConfig,
  apiKey: string,
  endpoint: string
): Promise<TransportResult> {
  if (events.length === 0) {
    return { success: true };
  }

  const result = await withRetry(
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "User-Agent": "tollgate-sdk/0.1.0",
          },
          body: JSON.stringify(events),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return {
          success: true,
          statusCode: response.status,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
    {
      maxRetries: config.maxRetries,
      baseDelayMs: 1000,
      maxDelayMs: 30_000,
    }
  );

  if (result) {
    return result;
  }

  // Retry exhausted - fail open
  return {
    success: false,
    error: "All retry attempts exhausted",
  };
}
