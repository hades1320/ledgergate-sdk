/**
 * Core module - Configuration, context, timing, and sampling
 */

// Configuration
export type {
  parseConfig,
  RedactionConfig,
  RedactionConfigSchema,
  SdkConfig,
  SdkConfigInput,
  SdkConfigSchema,
  safeParseConfig,
  TransportConfig,
  TransportConfigSchema,
} from "./config.js";
// Request context
export type {
  CreateContextOptions,
  captureResponseData,
  createRequestContext,
  RequestContext,
  ResponseData,
} from "./context.js";
// Privacy
export type { extractClientIp, hashIp } from "./privacy.js";
// Redaction
export type { isSensitiveHeader, redactHeaders } from "./redaction.js";

// Sampling
export type { shouldSample } from "./sampling.js";
// Timing utilities
export type { createTimer, getTimestamp, Timer } from "./timing.js";
