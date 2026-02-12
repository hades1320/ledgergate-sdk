import { describe, expect, it } from "vitest";
import { detectX402, isPaymentRequired } from "./detector.js";

describe("detectX402", () => {
  describe("HTTP 402 detection", () => {
    it("should detect 402 status code as payment required", () => {
      const result = detectX402(402, {});
      expect(result).toBeDefined();
      expect(result?.isPaymentRequired).toBe(true);
    });

    it("should not detect non-402 status codes as payment required", () => {
      const statuses = [200, 201, 301, 400, 401, 403, 404, 500, 502];
      for (const status of statuses) {
        const result = detectX402(status, {});
        expect(result?.isPaymentRequired ?? false).toBe(false);
      }
    });
  });

  describe("payment header extraction", () => {
    it("should extract x-payment-address header", () => {
      const result = detectX402(402, {
        "x-payment-address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      });
      expect(result?.paymentAddress).toBe(
        "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
      );
    });

    it("should extract x-payment-amount header", () => {
      const result = detectX402(402, {
        "x-payment-amount": "1000",
      });
      expect(result?.paymentAmount).toBe("1000");
    });

    it("should extract x-payment-network header", () => {
      const result = detectX402(402, {
        "x-payment-network": "Bitcoin",
      });
      expect(result?.paymentNetwork).toBe("bitcoin");
    });

    it("should extract x-payment-token header", () => {
      const result = detectX402(402, {
        "x-payment-token": "btc",
      });
      expect(result?.paymentToken).toBe("BTC");
    });

    it("should extract x-payment-status header", () => {
      const result = detectX402(402, {
        "x-payment-status": "required",
      });
      expect(result?.paymentStatus).toBe("required");
    });

    it("should extract all payment headers together", () => {
      const result = detectX402(402, {
        "x-payment-address": "addr123",
        "x-payment-amount": "500",
        "x-payment-network": "lightning",
        "x-payment-token": "sats",
        "x-payment-status": "required",
      });

      expect(result).toEqual({
        isPaymentRequired: true,
        paymentAddress: "addr123",
        paymentAmount: "500",
        paymentNetwork: "lightning",
        paymentToken: "SATS",
        paymentStatus: "required",
      });
    });
  });

  describe("L402/LSAT header parsing", () => {
    it("should parse L402 WWW-Authenticate header", () => {
      const result = detectX402(402, {
        "www-authenticate": 'L402 invoice="lnbc10u1..."',
      });
      expect(result?.paymentAddress).toBe("lnbc10u1...");
      expect(result?.paymentNetwork).toBe("lightning");
    });

    it("should handle L402 header case-insensitively", () => {
      const result = detectX402(402, {
        "www-authenticate": 'l402 invoice="lnbc20u1..."',
      });
      expect(result?.paymentAddress).toBe("lnbc20u1...");
    });
  });

  describe("non-402 with payment headers", () => {
    it("should detect payment metadata on non-402 responses with payment headers", () => {
      const result = detectX402(200, {
        "x-payment-status": "verified",
        "x-payment-address": "addr123",
      });
      expect(result).toBeDefined();
      expect(result?.isPaymentRequired).toBe(false);
      expect(result?.paymentStatus).toBe("verified");
    });

    it("should return undefined for non-402 without payment headers", () => {
      const result = detectX402(200, {
        "content-type": "application/json",
      });
      expect(result).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty headers object", () => {
      const result = detectX402(402, {});
      expect(result).toEqual({
        isPaymentRequired: true,
      });
    });

    it("should handle array header values", () => {
      const result = detectX402(402, {
        "x-payment-address": ["addr1", "addr2"],
      });
      expect(result?.paymentAddress).toBe("addr1");
    });

    it("should handle undefined header values gracefully", () => {
      const result = detectX402(402, {
        "x-payment-address": undefined,
      });
      expect(result).toBeDefined();
      expect(result?.paymentAddress).toBeUndefined();
    });

    it("should ignore invalid payment status values", () => {
      const result = detectX402(402, {
        "x-payment-status": "invalid-status",
      });
      expect(result?.paymentStatus).toBeUndefined();
    });

    it("should accept valid payment status values", () => {
      const validStatuses = ["required", "verified", "failed"];
      for (const status of validStatuses) {
        const result = detectX402(402, {
          "x-payment-status": status,
        });
        expect(result?.paymentStatus).toBe(status);
      }
    });
  });
});

describe("isPaymentRequired", () => {
  it("should return true for status 402", () => {
    expect(isPaymentRequired(402)).toBe(true);
  });

  it("should return false for other status codes", () => {
    expect(isPaymentRequired(200)).toBe(false);
    expect(isPaymentRequired(401)).toBe(false);
    expect(isPaymentRequired(403)).toBe(false);
    expect(isPaymentRequired(500)).toBe(false);
  });
});
