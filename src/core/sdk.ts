import type { SdkInstance } from "../adapters/types.js";
import { createEventQueue } from "../transport/queue.js";
import type { EventQueue } from "../transport/types.js";
import { parseConfig, type SdkConfig, type SdkConfigInput } from "./config.js";

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
