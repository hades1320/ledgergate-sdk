import type { SdkInstance } from "../adapters/types.js";
import { createEventQueue } from "../transport/queue.js";
import type { EventQueue } from "../transport/types.js";
import { parseConfig, type SdkConfig, type SdkConfigInput } from "./config.js";

/**
 * Creates a new Tollgate SDK instance.
 *
 * This is the main entry point for the SDK. It validates the provided
 * configuration, applies defaults, and initializes the event queue.
 *
 * @param config - SDK configuration options. Only `apiKey` is required.
 * @returns An initialized `SdkInstance` ready to be used with an adapter.
 * @throws {ZodError} If the configuration fails validation.
 *
 * @example
 * ```typescript
 * import { createTollgateSdk, createExpressMiddleware } from "tollgate-sdk";
 *
 * const sdk = createTollgateSdk({
 *   apiKey: process.env.TOLLGATE_API_KEY!,
 *   debug: process.env.NODE_ENV !== "production",
 * });
 *
 * app.use(createExpressMiddleware(sdk));
 *
 * // Graceful shutdown
 * process.on("SIGTERM", async () => {
 *   await sdk.shutdown();
 *   process.exit(0);
 * });
 * ```
 */
export function createTollgateSdk(config: SdkConfigInput): SdkInstance {
  const validated: SdkConfig = parseConfig(config);
  const queue: EventQueue = createEventQueue({
    transport: validated.transport,
    apiKey: validated.apiKey,
    endpoint: validated.endpoint,
    debug: validated.debug,
  });

  return {
    config: validated,
    queue,
    async shutdown(): Promise<void> {
      await queue.shutdown();
    },
  };
}
