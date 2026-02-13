import { describe, expect, it } from "vitest";
import { parsePaymentBody, parsePaymentHeaders } from "./parser.js";

describe("parsePaymentHeaders", () => {
  describe("x-payment-address header", () => {
    it("should extract payment address", () => {
      const result = parsePaymentHeaders({
        "x-payment-address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      });
      expect(result.paymentAddress).toBe(
        "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
      );
    });

    it("should handle array value", () => {
      const result = parsePaymentHeaders({
        "x-payment-address": ["addr1", "addr2"],
      });
      expect(result.paymentAddress).toBe("addr1");
    });
  });

  describe("x-payment-amount header", () => {
    it("should extract payment amount", () => {
      const result = parsePaymentHeaders({
        "x-payment-amount": "1000",
      });
      expect(result.paymentAmount).toBe("1000");
    });

    it("should preserve amount as string", () => {
      const result = parsePaymentHeaders({
        "x-payment-amount": "0.00001",
      });
      expect(result.paymentAmount).toBe("0.00001");
      expect(typeof result.paymentAmount).toBe("string");
    });
  });

  describe("x-payment-network header", () => {
    it("should extract and lowercase network", () => {
      const result = parsePaymentHeaders({
        "x-payment-network": "Bitcoin",
      });
      expect(result.paymentNetwork).toBe("bitcoin");
    });

    it("should handle various network names", () => {
      const networks = [
        { input: "ETHEREUM", expected: "ethereum" },
        { input: "Lightning", expected: "lightning" },
        { input: "BASE", expected: "base" },
        { input: "polygon", expected: "polygon" },
      ];

      for (const { input, expected } of networks) {
        const result = parsePaymentHeaders({
          "x-payment-network": input,
        });
        expect(result.paymentNetwork).toBe(expected);
      }
    });
  });

  describe("x-payment-token header", () => {
    it("should extract and uppercase token", () => {
      const result = parsePaymentHeaders({
        "x-payment-token": "btc",
      });
      expect(result.paymentToken).toBe("BTC");
    });

    it("should handle various token names", () => {
      const tokens = [
        { input: "eth", expected: "ETH" },
        { input: "SATS", expected: "SATS" },
        { input: "usdc", expected: "USDC" },
        { input: "Dai", expected: "DAI" },
      ];

      for (const { input, expected } of tokens) {
        const result = parsePaymentHeaders({
          "x-payment-token": input,
        });
        expect(result.paymentToken).toBe(expected);
      }
    });
  });

  describe("x-payment-status header", () => {
    it("should extract valid status values", () => {
      const validStatuses = ["required", "verified", "failed"];
      for (const status of validStatuses) {
        const result = parsePaymentHeaders({
          "x-payment-status": status,
        });
        expect(result.paymentStatus).toBe(status);
      }
    });

    it("should handle case-insensitive status", () => {
      const result = parsePaymentHeaders({
        "x-payment-status": "VERIFIED",
      });
      expect(result.paymentStatus).toBe("verified");
    });

    it("should ignore invalid status values", () => {
      const result = parsePaymentHeaders({
        "x-payment-status": "pending",
      });
      expect(result.paymentStatus).toBeUndefined();
    });
  });

  describe("L402 WWW-Authenticate header", () => {
    it("should parse L402 invoice from WWW-Authenticate", () => {
      const result = parsePaymentHeaders({
        "www-authenticate": 'L402 invoice="lnbc10u1p3pj257..."',
      });
      expect(result.paymentAddress).toBe("lnbc10u1p3pj257...");
      expect(result.paymentNetwork).toBe("lightning");
    });

    it("should handle lowercase l402", () => {
      const result = parsePaymentHeaders({
        "www-authenticate": 'l402 invoice="lnbc20u1..."',
      });
      expect(result.paymentAddress).toBe("lnbc20u1...");
    });

    it("should not parse non-L402 WWW-Authenticate headers", () => {
      const result = parsePaymentHeaders({
        "www-authenticate": "Bearer realm=api",
      });
      expect(result.paymentAddress).toBeUndefined();
      expect(result.paymentNetwork).toBeUndefined();
    });

    it("should handle L402 header with additional parameters", () => {
      const result = parsePaymentHeaders({
        "www-authenticate": 'L402 invoice="lnbc10u1...", macaroon="AgEMbG5..."',
      });
      expect(result.paymentAddress).toBe("lnbc10u1...");
    });
  });

  describe("combined headers", () => {
    it("should parse all headers together", () => {
      const result = parsePaymentHeaders({
        "x-payment-address": "addr123",
        "x-payment-amount": "500",
        "x-payment-network": "bitcoin",
        "x-payment-token": "sats",
        "x-payment-status": "required",
      });

      expect(result).toEqual({
        paymentAddress: "addr123",
        paymentAmount: "500",
        paymentNetwork: "bitcoin",
        paymentToken: "SATS",
        paymentStatus: "required",
      });
    });

    it("should not include isPaymentRequired in result", () => {
      const result = parsePaymentHeaders({
        "x-payment-address": "addr123",
      });
      expect("isPaymentRequired" in result).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty headers object", () => {
      const result = parsePaymentHeaders({});
      expect(result).toEqual({});
    });

    it("should handle undefined header values", () => {
      const result = parsePaymentHeaders({
        "x-payment-address": undefined,
        "x-payment-amount": undefined,
      });
      expect(result).toEqual({});
    });

    it("should handle non-payment headers", () => {
      const result = parsePaymentHeaders({
        "content-type": "application/json",
        "cache-control": "no-cache",
      });
      expect(result).toEqual({});
    });

    it("should handle mixed payment and non-payment headers", () => {
      const result = parsePaymentHeaders({
        "content-type": "application/json",
        "x-payment-amount": "100",
        "cache-control": "no-cache",
      });
      expect(result).toEqual({
        paymentAmount: "100",
      });
    });
  });
});

describe("parsePaymentHeaders with custom fieldMapping", () => {
  it("should use custom field mapping for address", () => {
    const result = parsePaymentHeaders(
      {
        "pay-to": "addr123",
      },
      { address: "pay-to" }
    );
    expect(result.paymentAddress).toBe("addr123");
  });

  it("should use custom field mapping for all fields", () => {
    const result = parsePaymentHeaders(
      {
        "pay-addr": "addr456",
        "pay-amt": "1000",
        "pay-net": "ETHEREUM",
        "pay-tok": "eth",
        "pay-stat": "VERIFIED",
      },
      {
        address: "pay-addr",
        amount: "pay-amt",
        network: "pay-net",
        token: "pay-tok",
        status: "pay-stat",
      }
    );

    expect(result).toEqual({
      paymentAddress: "addr456",
      paymentAmount: "1000",
      paymentNetwork: "ethereum",
      paymentToken: "ETH",
      paymentStatus: "verified",
    });
  });

  it("should use defaults for unmapped fields", () => {
    const result = parsePaymentHeaders(
      {
        "custom-address": "addr789",
        "x-payment-amount": "500",
      },
      { address: "custom-address" }
    );
    expect(result.paymentAddress).toBe("addr789");
    expect(result.paymentAmount).toBe("500");
  });
});

describe("parsePaymentBody", () => {
  it("should extract payment address from body", () => {
    const result = parsePaymentBody({
      "x-payment-address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    });
    expect(result.paymentAddress).toBe(
      "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
    );
  });

  it("should extract payment amount from body", () => {
    const result = parsePaymentBody({
      "x-payment-amount": "1000",
    });
    expect(result.paymentAmount).toBe("1000");
  });

  it("should extract and lowercase network", () => {
    const result = parsePaymentBody({
      "x-payment-network": "Bitcoin",
    });
    expect(result.paymentNetwork).toBe("bitcoin");
  });

  it("should extract and uppercase token", () => {
    const result = parsePaymentBody({
      "x-payment-token": "btc",
    });
    expect(result.paymentToken).toBe("BTC");
  });

  it("should extract valid status values", () => {
    const validStatuses = ["required", "verified", "failed"];
    for (const status of validStatuses) {
      const result = parsePaymentBody({
        "x-payment-status": status,
      });
      expect(result.paymentStatus).toBe(status);
    }
  });

  it("should ignore invalid status values", () => {
    const result = parsePaymentBody({
      "x-payment-status": "pending",
    });
    expect(result.paymentStatus).toBeUndefined();
  });

  it("should parse all payment fields together", () => {
    const result = parsePaymentBody({
      "x-payment-address": "addr123",
      "x-payment-amount": "500",
      "x-payment-network": "lightning",
      "x-payment-token": "sats",
      "x-payment-status": "required",
    });

    expect(result).toEqual({
      paymentAddress: "addr123",
      paymentAmount: "500",
      paymentNetwork: "lightning",
      paymentToken: "SATS",
      paymentStatus: "required",
    });
  });

  it("should handle empty body object", () => {
    const result = parsePaymentBody({});
    expect(result).toEqual({});
  });

  it("should ignore non-string values", () => {
    const result = parsePaymentBody({
      "x-payment-address": 123,
      "x-payment-amount": null,
      "x-payment-network": undefined,
      "x-payment-token": true,
    });
    expect(result).toEqual({});
  });

  it("should not include isPaymentRequired in result", () => {
    const result = parsePaymentBody({
      "x-payment-address": "addr123",
    });
    expect("isPaymentRequired" in result).toBe(false);
  });
});

describe("parsePaymentBody with custom fieldMapping", () => {
  it("should use custom field mapping for address", () => {
    const result = parsePaymentBody(
      {
        address: "addr123",
      },
      { address: "address" }
    );
    expect(result.paymentAddress).toBe("addr123");
  });

  it("should use custom field mapping for all fields", () => {
    const result = parsePaymentBody(
      {
        wallet: "addr456",
        price: "1000",
        blockchain: "ETHEREUM",
        currency: "eth",
        state: "VERIFIED",
      },
      {
        address: "wallet",
        amount: "price",
        network: "blockchain",
        token: "currency",
        status: "state",
      }
    );

    expect(result).toEqual({
      paymentAddress: "addr456",
      paymentAmount: "1000",
      paymentNetwork: "ethereum",
      paymentToken: "ETH",
      paymentStatus: "verified",
    });
  });

  it("should use defaults for unmapped fields", () => {
    const result = parsePaymentBody(
      {
        customAddress: "addr789",
        "x-payment-amount": "500",
      },
      { address: "customAddress" }
    );
    expect(result.paymentAddress).toBe("addr789");
    expect(result.paymentAmount).toBe("500");
  });
});
