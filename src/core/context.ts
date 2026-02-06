import { randomUUID } from "node:crypto";
import type { RedactionConfig } from "./config.js";
import { extractClientIp, hashIp } from "./privacy.js";
import { redactHeaders } from "./redaction.js";
import { createTimer, type Timer } from "./timing.js";

/**
 * Immutable request context created at the start of each request
 */
export interface RequestContext {
  /** Unique identifier for this request (UUID v4) */
  readonly id: string;
  /** High-resolution timer started at context creation */
  readonly timer: Timer;
  /** HTTP method (GET, POST, etc.) */
  readonly method: string;
  /** Request path (without query string) */
  readonly path: string;
  /** Redacted headers from the request */
  readonly headers: Readonly<Record<string, string>>;
  /** Hashed client IP address (if available and configured) */
  readonly clientIpHash?: string;
  /** Whether this request is being sampled */
  readonly sampled: boolean;
}

/**
 * Mutable response data collected after the request completes
 */
export interface ResponseData {
  /** HTTP status code */
  statusCode: number;
  /** Response latency in milliseconds */
  latencyMs: number;
}

/**
 * Options for creating a request context
 */
export interface CreateContextOptions {
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** Request headers */
  headers: Record<string, string | string[] | undefined>;
  /** Direct connection IP address */
  remoteAddress?: string;
  /** Redaction configuration */
  redaction: RedactionConfig;
  /** Whether this request should be sampled */
  sampled: boolean;
}

/**
 * Creates a new request context
 * This should be called at the start of each request
 *
 * @param options - Context creation options
 * @returns Immutable request context
 */
export function createRequestContext(
  options: CreateContextOptions
): RequestContext {
  const { method, path, headers, remoteAddress, redaction, sampled } = options;

  // Extract and optionally hash the client IP
  let clientIpHash: string | undefined;
  if (redaction.hashIp) {
    const clientIp = extractClientIp(headers, remoteAddress);
    if (clientIp) {
      clientIpHash = hashIp(clientIp, redaction.ipHashSalt);
    }
  }

  const context: RequestContext = {
    id: randomUUID(),
    timer: createTimer(),
    method: method.toUpperCase(),
    path: normalizePath(path),
    headers: redactHeaders(headers, redaction.allowedHeaders),
    sampled,
  };

  // Only add clientIpHash if it's defined (exactOptionalPropertyTypes compliance)
  if (clientIpHash !== undefined) {
    return { ...context, clientIpHash };
  }

  return context;
}

/**
 * Normalizes a request path
 * - Removes query string
 * - Ensures path starts with /
 * - Removes trailing slashes (except for root)
 *
 * @param path - Raw request path
 * @returns Normalized path
 */
function normalizePath(path: string): string {
  // Remove query string
  const queryIndex = path.indexOf("?");
  let normalized = queryIndex >= 0 ? path.slice(0, queryIndex) : path;

  // Ensure leading slash
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }

  // Remove trailing slash (except for root)
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Captures response data from the completed request
 *
 * @param context - The request context
 * @param statusCode - HTTP response status code
 * @returns Response data with latency calculated
 */
export function captureResponseData(
  context: RequestContext,
  statusCode: number
): ResponseData {
  return {
    statusCode,
    latencyMs: context.timer.elapsed(),
  };
}
