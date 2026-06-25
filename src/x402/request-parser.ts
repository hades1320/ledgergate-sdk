import type { X402RequestMetadata } from "./types.js";

/**
 * Parses an incoming L402 Authorization header.
 * Expected format: "L402 <base64_macaroon>:<hex_preimage>"
 * Or just "L402 <base64_macaroon>"
 *
 * @param authorizationHeader - The raw Authorization header value from the request
 * @returns Parsed X402RequestMetadata, or undefined if the header is not a valid L402 format.
 */
export function parseL402RequestHeader(
	authorizationHeader: string
): X402RequestMetadata | undefined {
	const trimmed = authorizationHeader.trim();
	const spaceIndex = trimmed.indexOf(" ");
	if (spaceIndex === -1) {
		return undefined;
	}

	const scheme = trimmed.slice(0, spaceIndex).toLowerCase();
	if (scheme !== "l402") {
		return undefined;
	}

	const credentials = trimmed.slice(spaceIndex + 1).trim();
	if (!credentials) {
		return undefined;
	}

	const colonIndex = credentials.indexOf(":");
	if (colonIndex === -1) {
		// Only macaroon is present
		return {
			paymentToken: credentials,
			paymentNetwork: "lightning",
			hasPaymentProof: false,
		};
	}

	const macaroon = credentials.slice(0, colonIndex);
	const preimage = credentials.slice(colonIndex + 1);

	return {
		paymentToken: macaroon || undefined,
		paymentNetwork: "lightning",
		hasPaymentProof: preimage.trim().length > 0,
	};
}
