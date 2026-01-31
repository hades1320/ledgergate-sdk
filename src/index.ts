/**
 * tollgate-sdk
 *
 * x402 Observability SDK for HTTP APIs
 * Lightweight, non-custodial observability for x402-monetized APIs.
 *
 * @packageDocumentation
 */

// Core exports (will be populated in Phase 1)
// export { createTollgateSdk } from './core/sdk';
// export type { SdkConfig } from './core/config';

// x402 exports (will be populated in Phase 2)
// export type { X402Metadata } from './x402/types';

// Event exports (will be populated in Phase 3)
// export type { AnalyticsEvent } from './events/schema';

// Adapter exports (will be populated in Phase 5)
// export { createExpressMiddleware } from './adapters/express';
// export { fastifyTollgate } from './adapters/fastify';

/**
 * SDK version - injected at build time
 */
export const SDK_VERSION = "0.1.0";

/**
 * SDK name constant
 */
export const SDK_NAME = "tollgate-sdk" as const;
