import type { PaymentFieldMapping } from "./config.js";
import { DEFAULT_FIELD_MAPPING } from "./config.js";
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
 * @param fieldMapping - Optional custom key mapping for payment fields
 * @returns Partial metadata extracted from headers
 */
export function parsePaymentHeaders(
  headers: Record<string, string | string[] | undefined>,
  fieldMapping?: PaymentFieldMapping
): Partial<X402Metadata> {
  const result: MutableX402Metadata = {
    isPaymentRequired: false,
  };

  // Use provided mapping or defaults
  const mapping = {
    address: fieldMapping?.address ?? DEFAULT_FIELD_MAPPING.address,
    amount: fieldMapping?.amount ?? DEFAULT_FIELD_MAPPING.amount,
    network: fieldMapping?.network ?? DEFAULT_FIELD_MAPPING.network,
    token: fieldMapping?.token ?? DEFAULT_FIELD_MAPPING.token,
    status: fieldMapping?.status ?? DEFAULT_FIELD_MAPPING.status,
  };

  const getHeader = (name: string): string | undefined => {
    const value = headers[name] || headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  };

  // Extract core payment fields from headers using configured keys
  const address = getHeader(mapping.address);
  if (address) {
    result.paymentAddress = address;
  }

  const amount = getHeader(mapping.amount);
  if (amount) {
    result.paymentAmount = amount;
  }

  const network = getHeader(mapping.network);
  if (network) {
    result.paymentNetwork = network.toLowerCase();
  }

  const token = getHeader(mapping.token);
  if (token) {
    result.paymentToken = token.toUpperCase();
  }

  const status = getHeader(mapping.status);
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

/**
 * Parses payment metadata from a JSON response body
 *
 * @param body - Parsed JSON response body
 * @param fieldMapping - Optional custom key mapping for payment fields
 * @returns Partial metadata extracted from body
 */
export function parsePaymentBody(
  body: Record<string, unknown>,
  fieldMapping?: PaymentFieldMapping
): Partial<X402Metadata> {
  const result: MutableX402Metadata = {
    isPaymentRequired: false,
  };

  // Use provided mapping or defaults
  const mapping = {
    address: fieldMapping?.address ?? DEFAULT_FIELD_MAPPING.address,
    amount: fieldMapping?.amount ?? DEFAULT_FIELD_MAPPING.amount,
    network: fieldMapping?.network ?? DEFAULT_FIELD_MAPPING.network,
    token: fieldMapping?.token ?? DEFAULT_FIELD_MAPPING.token,
    status: fieldMapping?.status ?? DEFAULT_FIELD_MAPPING.status,
  };

  // Extract core payment fields from body using configured keys
  const address = body[mapping.address];
  if (typeof address === "string" && address) {
    result.paymentAddress = address;
  }

  const amount = body[mapping.amount];
  if (typeof amount === "string" && amount) {
    result.paymentAmount = amount;
  }

  const network = body[mapping.network];
  if (typeof network === "string" && network) {
    result.paymentNetwork = network.toLowerCase();
  }

  const token = body[mapping.token];
  if (typeof token === "string" && token) {
    result.paymentToken = token.toUpperCase();
  }

  const status = body[mapping.status];
  if (typeof status === "string") {
    const normalizedStatus = status.toLowerCase();
    if (
      normalizedStatus === "required" ||
      normalizedStatus === "verified" ||
      normalizedStatus === "failed"
    ) {
      result.paymentStatus = normalizedStatus;
    }
  }

  // Create final result without isPaymentRequired
  const { isPaymentRequired: _, ...finalResult } = result;
  return finalResult;
}
