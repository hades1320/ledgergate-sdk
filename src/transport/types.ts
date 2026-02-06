import type { AnalyticsEvent } from "../events/schema.js";

/**
 * Result of a transport operation
 */
export interface TransportResult {
  readonly success: boolean;
  readonly statusCode?: number;
  readonly error?: string;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

/**
 * Event queue interface
 */
export interface EventQueue {
  /**
   * Add an event to the queue
   * @param event - Analytics event to enqueue
   */
  enqueue(event: AnalyticsEvent): void;

  /**
   * Manually flush all pending events
   * @returns Promise that resolves when flush is complete
   */
  flush(): Promise<void>;

  /**
   * Shutdown the queue and flush remaining events
   * @returns Promise that resolves when shutdown is complete
   */
  shutdown(): Promise<void>;

  /**
   * Get the current queue size
   */
  size(): number;
}
