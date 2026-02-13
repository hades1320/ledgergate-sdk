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

describe("detectX402 with body source", () => {
  const config = {
    source: "body" as const,
    fieldMapping: {
      address: "x-payment-address",
      amount: "x-payment-amount",
      network: "x-payment-network",
      token: "x-payment-token",
      status: "x-payment-status",
    },
  };

  it("should extract metadata from body when source is 'body'", () => {
    const result = detectX402(402, {}, config, {
      "x-payment-address": "addr123",
      "x-payment-amount": "1000",
    });
    expect(result?.paymentAddress).toBe("addr123");
    expect(result?.paymentAmount).toBe("1000");
  });

  it("should ignore headers when source is 'body'", () => {
    const result = detectX402(
      402,
      { "x-payment-address": "header-addr" },
      config,
      { "x-payment-address": "body-addr" }
    );
    expect(result?.paymentAddress).toBe("body-addr");
  });

  it("should return undefined when body is not provided", () => {
    const result = detectX402(200, {}, config, undefined);
    expect(result).toBeUndefined();
  });
});

describe("detectX402 with both source", () => {
  const config = {
    source: "both" as const,
    fieldMapping: {
      address: "x-payment-address",
      amount: "x-payment-amount",
      network: "x-payment-network",
      token: "x-payment-token",
      status: "x-payment-status",
    },
  };

  it("should merge metadata from headers and body", () => {
    const result = detectX402(
      402,
      { "x-payment-address": "header-addr" },
      config,
      { "x-payment-amount": "1000" }
    );
    expect(result?.paymentAddress).toBe("header-addr");
    expect(result?.paymentAmount).toBe("1000");
  });

  it("should give headers precedence over body", () => {
    const result = detectX402(
      402,
      { "x-payment-address": "header-addr" },
      config,
      { "x-payment-address": "body-addr" }
    );
    expect(result?.paymentAddress).toBe("header-addr");
  });

  it("should work when only headers have metadata", () => {
    const result = detectX402(
      402,
      { "x-payment-address": "header-addr" },
      config,
      {}
    );
    expect(result?.paymentAddress).toBe("header-addr");
  });

  it("should work when only body has metadata", () => {
    const result = detectX402(402, {}, config, {
      "x-payment-address": "body-addr",
    });
    expect(result?.paymentAddress).toBe("body-addr");
  });
});

describe("detectX402 with custom fieldMapping", () => {
  const config = {
    source: "header" as const,
    fieldMapping: {
      address: "pay-to",
      amount: "pay-amt",
      network: "pay-net",
      token: "pay-tok",
      status: "pay-stat",
    },
  };

  it("should use custom field mapping for headers", () => {
    const result = detectX402(
      402,
      {
        "pay-to": "addr123",
        "pay-amt": "500",
        "pay-net": "BITCOIN",
        "pay-tok": "btc",
        "pay-stat": "required",
      },
      config
    );
    expect(result).toEqual({
      isPaymentRequired: true,
      paymentAddress: "addr123",
      paymentAmount: "500",
      paymentNetwork: "bitcoin",
      paymentToken: "BTC",
      paymentStatus: "required",
    });
  });

  it("should work with body source and custom field mapping", () => {
    const bodyConfig = {
      source: "body" as const,
      fieldMapping: {
        address: "wallet",
        amount: "price",
        network: "blockchain",
        token: "currency",
        status: "state",
      },
    };

    const result = detectX402(402, {}, bodyConfig, {
      wallet: "addr456",
      price: "1000",
      blockchain: "ethereum",
      currency: "eth",
      state: "verified",
    });

    expect(result).toEqual({
      isPaymentRequired: true,
      paymentAddress: "addr456",
      paymentAmount: "1000",
      paymentNetwork: "ethereum",
      paymentToken: "ETH",
      paymentStatus: "verified",
    });
  });
});
