import { describe, expect, it } from "vitest";
import { isSensitiveHeader, redactHeaders } from "./redaction.js";

describe("redactHeaders", () => {
  describe("sensitive header redaction", () => {
    it("should redact authorization header", () => {
      const headers = { authorization: "Bearer token123" };
      const result = redactHeaders(headers);
      expect(result.authorization).toBe("[REDACTED]");
    });

    it("should redact cookie header", () => {
      const headers = { cookie: "session=abc123" };
      const result = redactHeaders(headers);
      expect(result.cookie).toBe("[REDACTED]");
    });

    it("should redact set-cookie header", () => {
      const headers = { "set-cookie": "session=abc123" };
      const result = redactHeaders(headers);
      expect(result["set-cookie"]).toBe("[REDACTED]");
    });

    it("should redact x-api-key header", () => {
      const headers = { "x-api-key": "secret-key" };
      const result = redactHeaders(headers);
      expect(result["x-api-key"]).toBe("[REDACTED]");
    });

    it("should redact x-auth-token header", () => {
      const headers = { "x-auth-token": "token123" };
      const result = redactHeaders(headers);
      expect(result["x-auth-token"]).toBe("[REDACTED]");
    });

    it("should redact x-access-token header", () => {
      const headers = { "x-access-token": "access123" };
      const result = redactHeaders(headers);
      expect(result["x-access-token"]).toBe("[REDACTED]");
    });

    it("should redact x-csrf-token header", () => {
      const headers = { "x-csrf-token": "csrf123" };
      const result = redactHeaders(headers);
      expect(result["x-csrf-token"]).toBe("[REDACTED]");
    });

    it("should redact x-xsrf-token header", () => {
      const headers = { "x-xsrf-token": "xsrf123" };
      const result = redactHeaders(headers);
      expect(result["x-xsrf-token"]).toBe("[REDACTED]");
    });

    it("should redact proxy-authorization header", () => {
      const headers = { "proxy-authorization": "Basic abc123" };
      const result = redactHeaders(headers);
      expect(result["proxy-authorization"]).toBe("[REDACTED]");
    });

    it("should redact www-authenticate header", () => {
      const headers = { "www-authenticate": "Bearer realm=api" };
      const result = redactHeaders(headers);
      expect(result["www-authenticate"]).toBe("[REDACTED]");
    });

    it("should handle case-insensitive redaction", () => {
      const headers = {
        Authorization: "Bearer token",
        COOKIE: "session=123",
        "X-Api-Key": "key",
      };
      const result = redactHeaders(headers);
      expect(result.authorization).toBe("[REDACTED]");
      expect(result.cookie).toBe("[REDACTED]");
      expect(result["x-api-key"]).toBe("[REDACTED]");
    });
  });

  describe("non-sensitive headers", () => {
    it("should preserve content-type header", () => {
      const headers = { "content-type": "application/json" };
      const result = redactHeaders(headers);
      expect(result["content-type"]).toBe("application/json");
    });

    it("should preserve accept header", () => {
      const headers = { accept: "text/html" };
      const result = redactHeaders(headers);
      expect(result.accept).toBe("text/html");
    });

    it("should preserve user-agent header", () => {
      const headers = { "user-agent": "Mozilla/5.0" };
      const result = redactHeaders(headers);
      expect(result["user-agent"]).toBe("Mozilla/5.0");
    });

    it("should preserve custom non-sensitive headers", () => {
      const headers = { "x-custom-header": "value123" };
      const result = redactHeaders(headers);
      expect(result["x-custom-header"]).toBe("value123");
    });
  });

  describe("allowlist functionality", () => {
    it("should not redact headers in allowlist", () => {
      const headers = { authorization: "Bearer token" };
      const result = redactHeaders(headers, ["authorization"]);
      expect(result.authorization).toBe("Bearer token");
    });

    it("should handle case-insensitive allowlist", () => {
      const headers = { Authorization: "Bearer token" };
      const result = redactHeaders(headers, ["AUTHORIZATION"]);
      expect(result.authorization).toBe("Bearer token");
    });

    it("should allow multiple headers through allowlist", () => {
      const headers = {
        authorization: "Bearer token",
        cookie: "session=123",
        "x-api-key": "key",
      };
      const result = redactHeaders(headers, ["authorization", "cookie"]);
      expect(result.authorization).toBe("Bearer token");
      expect(result.cookie).toBe("session=123");
      expect(result["x-api-key"]).toBe("[REDACTED]");
    });
  });

  describe("header value handling", () => {
    it("should flatten array values to comma-separated string", () => {
      const headers = { accept: ["application/json", "text/html"] };
      const result = redactHeaders(headers);
      expect(result.accept).toBe("application/json, text/html");
    });

    it("should skip undefined values", () => {
      const headers = { "x-optional": undefined, "content-type": "text/plain" };
      const result = redactHeaders(headers);
      expect(result["x-optional"]).toBeUndefined();
      expect(result["content-type"]).toBe("text/plain");
    });

    it("should handle empty headers object", () => {
      const result = redactHeaders({});
      expect(result).toEqual({});
    });

    it("should lowercase all header names in output", () => {
      const headers = {
        "Content-Type": "application/json",
        "Accept-Language": "en-US",
      };
      const result = redactHeaders(headers);
      expect(Object.keys(result)).toEqual(["content-type", "accept-language"]);
    });
  });

  describe("mixed headers", () => {
    it("should handle mix of sensitive and non-sensitive headers", () => {
      const headers = {
        "content-type": "application/json",
        authorization: "Bearer token",
        accept: "text/html",
        cookie: "session=abc",
        "user-agent": "Test/1.0",
      };
      const result = redactHeaders(headers);

      expect(result["content-type"]).toBe("application/json");
      expect(result.authorization).toBe("[REDACTED]");
      expect(result.accept).toBe("text/html");
      expect(result.cookie).toBe("[REDACTED]");
      expect(result["user-agent"]).toBe("Test/1.0");
    });
  });
});

describe("isSensitiveHeader", () => {
  it("should return true for sensitive headers", () => {
    expect(isSensitiveHeader("authorization")).toBe(true);
    expect(isSensitiveHeader("cookie")).toBe(true);
    expect(isSensitiveHeader("set-cookie")).toBe(true);
    expect(isSensitiveHeader("x-api-key")).toBe(true);
    expect(isSensitiveHeader("x-auth-token")).toBe(true);
  });

  it("should return false for non-sensitive headers", () => {
    expect(isSensitiveHeader("content-type")).toBe(false);
    expect(isSensitiveHeader("accept")).toBe(false);
    expect(isSensitiveHeader("user-agent")).toBe(false);
    expect(isSensitiveHeader("x-custom-header")).toBe(false);
  });

  it("should handle case-insensitive comparison", () => {
    expect(isSensitiveHeader("Authorization")).toBe(true);
    expect(isSensitiveHeader("COOKIE")).toBe(true);
    expect(isSensitiveHeader("X-Api-Key")).toBe(true);
  });
});
