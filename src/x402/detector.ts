import { parsePaymentHeaders } from "./parser.js";
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
 * @returns X402Metadata if detected, otherwise undefined
 */
export function detectX402(
  statusCode: number,
  headers: Record<string, string | string[] | undefined>
): X402Metadata | undefined {
  const isPaymentRequired = statusCode === HTTP_402_PAYMENT_REQUIRED;
  const paymentMetadata = parsePaymentHeaders(headers);

  // If it's a 402 or if we found any explicit payment headers, return metadata
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
