/**
 * ledgergate-sdk
 *
 * x402 Observability SDK for HTTP APIs
 * Lightweight, non-custodial observability for x402-monetized APIs.
 *
 * @packageDocumentation
 */
// TODO: Remove this biome ignore.
/** biome-ignore-all lint/performance/noBarrelFile: false */

// Adapter exports
export { createExpressMiddleware } from "./adapters/express.js";
export {
  type FastifyLedgergateOptions,
  fastifyLedgergate,
} from "./adapters/fastify.js";
export type { SdkInstance } from "./adapters/types.js";
export {
  parseConfig,
  type RedactionConfig,
  RedactionConfigSchema,
  type SdkConfig,
  type SdkConfigInput,
  SdkConfigSchema,
  safeParseConfig,
  type TransportConfig,
  TransportConfigSchema,
} from "./core/config.js";
// Core exports
export {
  type CreateContextOptions,
  captureResponseData,
  createRequestContext,
  type RequestContext,
  type ResponseData,
} from "./core/context.js";
export { isExcludedPath } from "./core/paths.js";
export { extractClientIp, hashIp } from "./core/privacy.js";
export { isSensitiveHeader, redactHeaders } from "./core/redaction.js";
export { shouldSample } from "./core/sampling.js";
export { createLedgergateSdk } from "./core/sdk.js";
export { createTimer, getTimestamp, type Timer } from "./core/timing.js";
export {
  buildPaymentFailedEvent,
  buildPaymentRequiredEvent,
  buildPaymentVerifiedEvent,
  buildRequestCompletedEvent,
  buildRequestReceivedEvent,
} from "./events/builders.js";
// Event exports
export {
  type AnalyticsEvent,
  AnalyticsEventSchema,
} from "./events/schema.js";
export { EventType, type PaymentStatus } from "./events/types.js";
// x402 exports
export {
  applyX402DetectionDefaults,
  type PaymentFieldMapping,
  type PaymentMetadataSource,
  type X402DetectionConfig,
  X402DetectionConfigSchema,
} from "./x402/config.js";
export { detectX402, isPaymentRequired } from "./x402/detector.js";
export { parsePaymentBody, parsePaymentHeaders } from "./x402/parser.js";
export type { X402Metadata } from "./x402/types.js";

/**
 * SDK version - injected at build time
 */
export const SDK_VERSION = "1.0.0";

/**
 * SDK name constant
 */
export const SDK_NAME = "ledgergate-sdk" as const;
