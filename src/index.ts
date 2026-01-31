/**
 * tollgate-sdk
 *
 * x402 Observability SDK for HTTP APIs
 * Lightweight, non-custodial observability for x402-monetized APIs.
 *
 * @packageDocumentation
 */

// Core exports
export type {
  CreateContextOptions,
  captureResponseData,
  createRequestContext,
  createTimer,
  extractClientIp,
  getTimestamp,
  hashIp,
  isSensitiveHeader,
  parseConfig,
  RedactionConfig,
  RequestContext,
  ResponseData,
  redactHeaders,
  SdkConfig,
  SdkConfigInput,
  SdkConfigSchema,
  safeParseConfig,
  shouldSample,
  Timer,
  TransportConfig,
} from "./core/index.js";
// Event exports
export type {
  AnalyticsEvent,
  AnalyticsEventSchema,
  buildPaymentFailedEvent,
  buildPaymentRequiredEvent,
  buildPaymentVerifiedEvent,
  buildRequestCompletedEvent,
  buildRequestReceivedEvent,
  EventType,
  PaymentStatus,
} from "./events/index.js";
// x402 exports
export type {
  detectX402,
  isPaymentRequired,
  parsePaymentHeaders,
  X402Metadata,
} from "./x402/index.js";

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
