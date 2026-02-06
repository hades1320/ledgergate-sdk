import type { SdkConfig } from "../core/config.js";
import type { EventQueue } from "../transport/types.js";

/**
 * Common interface for the SDK instance used by adapters
 */
export interface SdkInstance {
  /** Resolved SDK configuration */
  readonly config: SdkConfig;
  /** Event queue for sending events */
  readonly queue: EventQueue;
  /** Graceful shutdown method */
  shutdown(): Promise<void>;
}
