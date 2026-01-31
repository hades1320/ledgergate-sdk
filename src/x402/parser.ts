import type { X402Metadata } from "./types.js";

/**
 * Regex for extracting invoice from L402 WWW-Authenticate header
 */
const L402_INVOICE_REGEX = /invoice="([^"]+)"/i;

/**
 * Mutable version of X402Metadata for internal parsing
 */
interface MutableX402Metadata {
  isPaymentRequired: boolean;
  paymentAddress?: string;
  paymentAmount?: string;
  paymentNetwork?: string;
  paymentToken?: string;
  paymentStatus?: "required" | "verified" | "failed";
}

/**
 * Parses individual payment headers into a partial X402Metadata object
 * Handles X-Payment-Address, X-Payment-Amount, etc.
 *
 * @param headers - Response headers
 * @returns Partial metadata extracted from headers
 */
export function parsePaymentHeaders(
  headers: Record<string, string | string[] | undefined>
): Partial<X402Metadata> {
  const result: MutableX402Metadata = {
    isPaymentRequired: false,
  };

  const getHeader = (name: string): string | undefined => {
    const value = headers[name] || headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  };

  // Extract core payment fields from common X-Payment-* headers
  const address = getHeader("x-payment-address");
  if (address) {
    result.paymentAddress = address;
  }

  const amount = getHeader("x-payment-amount");
  if (amount) {
    result.paymentAmount = amount;
  }

  const network = getHeader("x-payment-network");
  if (network) {
    result.paymentNetwork = network.toLowerCase();
  }

  const token = getHeader("x-payment-token");
  if (token) {
    result.paymentToken = token.toUpperCase();
  }

  const status = getHeader("x-payment-status");
  if (status) {
    const normalizedStatus = status.toLowerCase();
    if (
      normalizedStatus === "required" ||
      normalizedStatus === "verified" ||
      normalizedStatus === "failed"
    ) {
      result.paymentStatus = normalizedStatus;
    }
  }

  // Handle WWW-Authenticate as an alternative for L402/LSAT
  const wwwAuthenticate = getHeader("www-authenticate");
  if (wwwAuthenticate?.toLowerCase().startsWith("l402")) {
    parseL402Header(wwwAuthenticate, result);
  }

  // Create final result without isPaymentRequired
  const { isPaymentRequired: _, ...finalResult } = result;
  return finalResult;
}

/**
 * Parses a L402 (formerly LSAT) WWW-Authenticate header
 * Example: L402 invoice="...", macaroon="..."
 */
function parseL402Header(value: string, target: MutableX402Metadata): void {
  // Simple regex-based extraction for L402 fields
  const invoiceMatch = value.match(L402_INVOICE_REGEX);
  if (invoiceMatch?.[1]) {
    target.paymentAddress = invoiceMatch[1]; // In L402, the invoice is often the address/identifier
    target.paymentNetwork = "lightning";
  }
}
