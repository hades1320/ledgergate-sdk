import type { TransportConfig } from "../core/config.js";
import type { AnalyticsEvent } from "../events/schema.js";
import { sendBatch } from "./http.js";
import type { EventQueue } from "./types.js";

/**
 * Configuration for event queue
 */
interface QueueConfig {
  readonly transport: TransportConfig;
  readonly apiKey: string;
  readonly endpoint: string;
  readonly debug: boolean;
}

/**
 * In-memory event queue with automatic batching and flushing
 */
export function createEventQueue(config: QueueConfig): EventQueue {
  const buffer: AnalyticsEvent[] = [];
  let flushTimer: NodeJS.Timeout | undefined;
  let isShuttingDown = false;
  let pendingFlush: Promise<void> | undefined;

  /**
   * Sends the current buffer to the transport layer
   */
  async function flushBuffer(): Promise<void> {
    // Clear the timer if it exists
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }

    // Nothing to flush
    if (buffer.length === 0) {
      return;
    }

    // Extract events to send
    const eventsToSend = buffer.splice(0, buffer.length);

    if (config.debug) {
      console.log(
        `[tollgate-sdk] Flushing ${eventsToSend.length} events to ${config.endpoint}`
      );
    }

    try {
      const result = await sendBatch(
        eventsToSend,
        config.transport,
        config.apiKey,
        config.endpoint
      );

      if (config.debug) {
        if (result.success) {
          console.log(
            `[tollgate-sdk] Successfully sent ${eventsToSend.length} events`
          );
        } else {
          console.warn(`[tollgate-sdk] Failed to send events: ${result.error}`);
        }
      }
    } catch (error) {
      // Fail-open: log error but don't throw
      if (config.debug) {
        console.error("[tollgate-sdk] Error flushing events:", error);
      }
    }
  }

  /**
   * Schedules an automatic flush
   */
  function scheduleFlush(): void {
    // Don't schedule if already scheduled or shutting down
    if (flushTimer || isShuttingDown) {
      return;
    }

    flushTimer = setTimeout(() => {
      flushTimer = undefined;
      pendingFlush = flushBuffer();
    }, config.transport.flushIntervalMs);
  }

  /**
   * Checks if buffer should be flushed immediately
   */
  function shouldFlushImmediately(): boolean {
    return buffer.length >= config.transport.batchSize;
  }

  return {
    enqueue(event: AnalyticsEvent): void {
      // Don't accept new events during shutdown
      if (isShuttingDown) {
        if (config.debug) {
          console.warn("[tollgate-sdk] Queue is shutting down, event dropped");
        }
        return;
      }

      // Add to buffer
      buffer.push(event);

      if (config.debug) {
        console.log(
          `[tollgate-sdk] Event enqueued (${buffer.length}/${config.transport.batchSize})`
        );
      }

      // Flush immediately if batch size reached
      if (shouldFlushImmediately()) {
        pendingFlush = flushBuffer();
      } else {
        // Otherwise schedule a flush
        scheduleFlush();
      }
    },

    async flush(): Promise<void> {
      // Wait for any pending flush to complete
      if (pendingFlush) {
        await pendingFlush;
      }

      // Flush remaining events
      await flushBuffer();
    },

    async shutdown(): Promise<void> {
      if (isShuttingDown) {
        return;
      }

      isShuttingDown = true;

      if (config.debug) {
        console.log("[tollgate-sdk] Shutting down queue...");
      }

      // Clear any pending timer
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = undefined;
      }

      // Wait for pending flush
      if (pendingFlush) {
        await pendingFlush;
      }

      // Flush remaining events
      await flushBuffer();

      if (config.debug) {
        console.log("[tollgate-sdk] Queue shutdown complete");
      }
    },

    size(): number {
      return buffer.length;
    },
  };
}
