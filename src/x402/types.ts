/**
 * x402-specific payment metadata extracted from HTTP responses
 */
export interface X402Metadata {
  /** Whether the response indicated Payment Required (HTTP 402) */
  readonly isPaymentRequired: boolean;
  /** The destination payment address (e.g., wallet address or Lightning node ID) */
  readonly paymentAddress?: string;
  /** The requested payment amount (as a string to preserve precision) */
  readonly paymentAmount?: string;
  /** The payment network (e.g., bitcoin, lightning, ethereum) */
  readonly paymentNetwork?: string;
  /** The specific token or currency symbol (e.g., BTC, SATS, ETH) */
  readonly paymentToken?: string;
  /** Current payment status detected from headers */
  readonly paymentStatus?: "required" | "verified" | "failed";
}
