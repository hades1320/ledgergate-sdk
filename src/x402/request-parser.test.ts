import { describe, expect, it } from "vitest";
import { parseL402RequestHeader } from "./request-parser.js";

describe("parseL402RequestHeader", () => {
	it("should return undefined for empty or invalid scheme headers", () => {
		expect(parseL402RequestHeader("")).toBeUndefined();
		expect(parseL402RequestHeader("Bearer token")).toBeUndefined();
		expect(parseL402RequestHeader("L402")).toBeUndefined();
	});

	it("should parse L402 header with macaroon only", () => {
		const result = parseL402RequestHeader("L402 agF0b2tlbg==");
		expect(result).toEqual({
			paymentToken: "agF0b2tlbg==",
			paymentNetwork: "lightning",
			hasPaymentProof: false,
		});
	});

	it("should parse L402 header with macaroon and preimage", () => {
		const result = parseL402RequestHeader("L402 agF0b2tlbg==:0123456789abcdef");
		expect(result).toEqual({
			paymentToken: "agF0b2tlbg==",
			paymentNetwork: "lightning",
			hasPaymentProof: true,
		});
	});

	it("should handle case insensitivity for L402 prefix", () => {
		const result = parseL402RequestHeader("l402 agF0b2tlbg==:0123456789abcdef");
		expect(result?.paymentToken).toBe("agF0b2tlbg==");
	});
});
