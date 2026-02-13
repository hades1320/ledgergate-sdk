import type { X402DetectionConfig } from "./config.js";
import { parsePaymentBody, parsePaymentHeaders } from "./parser.js";
import type { X402Metadata } from "./types.js";

/**
 * Standard HTTP status code for Payment Required
 */
const HTTP_402_PAYMENT_REQUIRED = 402;

/**
 * Detects if a response contains x402 payment signals and extracts metadata
 *
 * @param statusCode - HTTP response status code
 * @param headers - HTTP response headers
 * @param config - Optional x402 detection configuration
 * @param body - Optional parsed JSON response body
 * @returns X402Metadata if detected, otherwise undefined
 */
export function detectX402(
  statusCode: number,
  headers: Record<string, string | string[] | undefined>,
  config?: X402DetectionConfig,
  body?: Record<string, unknown>
): X402Metadata | undefined {
  const isPaymentRequired = statusCode === HTTP_402_PAYMENT_REQUIRED;

  // Determine the source to use (default: "header")
  const source = config?.source ?? "header";
  const fieldMapping = config?.fieldMapping;

  let paymentMetadata: Partial<X402Metadata> = {};

  // Parse metadata based on configured source
  if (source === "header") {
    paymentMetadata = parsePaymentHeaders(headers, fieldMapping);
  } else if (source === "body" && body) {
    paymentMetadata = parsePaymentBody(body, fieldMapping);
  } else if (source === "both") {
    // Parse both, headers take precedence
    const bodyMetadata = body ? parsePaymentBody(body, fieldMapping) : {};
    const headerMetadata = parsePaymentHeaders(headers, fieldMapping);
    paymentMetadata = {
      ...bodyMetadata,
      ...headerMetadata, // Headers override body
    };
  }

  // If it's a 402 or if we found any explicit payment headers/body data, return metadata
  if (isPaymentRequired || Object.keys(paymentMetadata).length > 0) {
    return {
      isPaymentRequired,
      ...paymentMetadata,
    };
  }

  return undefined;
}

/**
 * Specifically checks if a response is a Payment Required (402) response
 * @param statusCode - HTTP status code
 * @returns true if status is 402
 */
export function isPaymentRequired(statusCode: number): boolean {
  return statusCode === HTTP_402_PAYMENT_REQUIRED;
}
