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

/**
 * x402-specific payment credentials extracted from incoming HTTP requests
 */
export interface X402RequestMetadata {
	/** The specific token or currency symbol (e.g., base64 macaroon in L402) */
	readonly paymentToken?: string | undefined;
	/** The payment network (e.g., lightning) */
	readonly paymentNetwork?: string | undefined;
	/** Whether the request contained payment proof (e.g., preimage/signature) */
	readonly hasPaymentProof: boolean;
}
