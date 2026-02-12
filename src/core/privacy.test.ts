import { describe, expect, it } from "vitest";
import { extractClientIp, hashIp } from "./privacy.js";

describe("hashIp", () => {
  describe("basic functionality", () => {
    it("should return a 16-character hex string", () => {
      const hash = hashIp("192.168.1.1");
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it("should be deterministic with same salt", () => {
      const hash1 = hashIp("192.168.1.1", "same-salt");
      const hash2 = hashIp("192.168.1.1", "same-salt");
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different IPs", () => {
      const hash1 = hashIp("192.168.1.1");
      const hash2 = hashIp("192.168.1.2");
      expect(hash1).not.toBe(hash2);
    });

    it("should produce different hashes with different salts", () => {
      const hash1 = hashIp("192.168.1.1", "salt1");
      const hash2 = hashIp("192.168.1.1", "salt2");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("salt handling", () => {
    it("should use default salt when not provided", () => {
      const hash1 = hashIp("10.0.0.1");
      const hash2 = hashIp("10.0.0.1");
      expect(hash1).toBe(hash2);
    });

    it("should use custom salt when provided", () => {
      const hashDefault = hashIp("10.0.0.1");
      const hashCustom = hashIp("10.0.0.1", "my-custom-salt");
      expect(hashDefault).not.toBe(hashCustom);
    });
  });

  describe("edge cases", () => {
    it("should handle IPv6 addresses", () => {
      const hash = hashIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it("should handle localhost", () => {
      const hash = hashIp("127.0.0.1");
      expect(hash).toHaveLength(16);
    });

    it("should handle empty string", () => {
      const hash = hashIp("");
      expect(hash).toHaveLength(16);
    });
  });
});

describe("extractClientIp", () => {
  describe("x-forwarded-for header", () => {
    it("should extract first IP from x-forwarded-for", () => {
      const headers = { "x-forwarded-for": "10.0.0.1, 10.0.0.2, 10.0.0.3" };
      const ip = extractClientIp(headers);
      expect(ip).toBe("10.0.0.1");
    });

    it("should handle single IP in x-forwarded-for", () => {
      const headers = { "x-forwarded-for": "192.168.1.100" };
      const ip = extractClientIp(headers);
      expect(ip).toBe("192.168.1.100");
    });

    it("should trim whitespace from IPs", () => {
      const headers = { "x-forwarded-for": "  10.0.0.1  , 10.0.0.2" };
      const ip = extractClientIp(headers);
      expect(ip).toBe("10.0.0.1");
    });

    it("should handle array value for x-forwarded-for", () => {
      const headers = { "x-forwarded-for": ["10.0.0.1, 10.0.0.2"] };
      const ip = extractClientIp(headers);
      expect(ip).toBe("10.0.0.1");
    });
  });

  describe("x-real-ip header", () => {
    it("should use x-real-ip when x-forwarded-for is not present", () => {
      const headers = { "x-real-ip": "172.16.0.1" };
      const ip = extractClientIp(headers);
      expect(ip).toBe("172.16.0.1");
    });

    it("should handle array value for x-real-ip", () => {
      const headers = { "x-real-ip": ["172.16.0.1"] };
      const ip = extractClientIp(headers);
      expect(ip).toBe("172.16.0.1");
    });

    it("should prefer x-forwarded-for over x-real-ip", () => {
      const headers = {
        "x-forwarded-for": "10.0.0.1",
        "x-real-ip": "172.16.0.1",
      };
      const ip = extractClientIp(headers);
      expect(ip).toBe("10.0.0.1");
    });
  });

  describe("direct IP fallback", () => {
    it("should use directIp when no proxy headers present", () => {
      const headers = {};
      const ip = extractClientIp(headers, "192.168.1.1");
      expect(ip).toBe("192.168.1.1");
    });

    it("should return undefined when no IP available", () => {
      const headers = {};
      const ip = extractClientIp(headers);
      expect(ip).toBeUndefined();
    });

    it("should use proxy headers over directIp", () => {
      const headers = { "x-forwarded-for": "10.0.0.1" };
      const ip = extractClientIp(headers, "192.168.1.1");
      expect(ip).toBe("10.0.0.1");
    });
  });

  describe("edge cases", () => {
    it("should handle empty x-forwarded-for", () => {
      const headers = { "x-forwarded-for": "" };
      const ip = extractClientIp(headers, "192.168.1.1");
      expect(ip).toBe("192.168.1.1");
    });

    it("should handle undefined header value", () => {
      const headers = { "x-forwarded-for": undefined };
      const ip = extractClientIp(headers, "192.168.1.1");
      expect(ip).toBe("192.168.1.1");
    });
  });
});
