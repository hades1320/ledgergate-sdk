import { describe, expect, it } from "vitest";
import {
  type CreateContextOptions,
  captureResponseData,
  createRequestContext,
} from "./context.js";

describe("createRequestContext", () => {
  const baseOptions: CreateContextOptions = {
    method: "GET",
    path: "/api/test",
    headers: { "content-type": "application/json" },
    redaction: { hashIp: true, allowedHeaders: [] },
    sampled: true,
  };

  describe("ID generation", () => {
    it("should generate a unique UUID for each context", () => {
      const ctx1 = createRequestContext(baseOptions);
      const ctx2 = createRequestContext(baseOptions);
      expect(ctx1.id).not.toBe(ctx2.id);
    });

    it("should generate valid UUID v4 format", () => {
      const ctx = createRequestContext(baseOptions);
      const uuidV4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(ctx.id).toMatch(uuidV4Regex);
    });
  });

  describe("method normalization", () => {
    it("should uppercase HTTP method", () => {
      const ctx = createRequestContext({ ...baseOptions, method: "get" });
      expect(ctx.method).toBe("GET");
    });

    it("should handle mixed case methods", () => {
      const ctx = createRequestContext({ ...baseOptions, method: "PoSt" });
      expect(ctx.method).toBe("POST");
    });
  });

  describe("path normalization", () => {
    it("should remove query string from path", () => {
      const ctx = createRequestContext({
        ...baseOptions,
        path: "/api/test?foo=bar",
      });
      expect(ctx.path).toBe("/api/test");
    });

    it("should ensure path starts with slash", () => {
      const ctx = createRequestContext({ ...baseOptions, path: "api/test" });
      expect(ctx.path).toBe("/api/test");
    });

    it("should remove trailing slash except for root", () => {
      const ctx = createRequestContext({
        ...baseOptions,
        path: "/api/test/",
      });
      expect(ctx.path).toBe("/api/test");
    });

    it("should keep root path as single slash", () => {
      const ctx = createRequestContext({ ...baseOptions, path: "/" });
      expect(ctx.path).toBe("/");
    });

    it("should handle empty path", () => {
      const ctx = createRequestContext({ ...baseOptions, path: "" });
      expect(ctx.path).toBe("/");
    });
  });

  describe("header redaction", () => {
    it("should redact sensitive headers by default", () => {
      const ctx = createRequestContext({
        ...baseOptions,
        headers: {
          "content-type": "application/json",
          authorization: "Bearer secret-token",
        },
      });
      expect(ctx.headers.authorization).toBe("[REDACTED]");
      expect(ctx.headers["content-type"]).toBe("application/json");
    });

    it("should lowercase header names", () => {
      const ctx = createRequestContext({
        ...baseOptions,
        headers: { "Content-Type": "application/json" },
      });
      expect(ctx.headers["content-type"]).toBe("application/json");
    });

    it("should flatten array header values", () => {
      const ctx = createRequestContext({
        ...baseOptions,
        headers: { accept: ["application/json", "text/html"] },
      });
      expect(ctx.headers.accept).toBe("application/json, text/html");
    });
  });

  describe("IP hashing", () => {
    it("should hash client IP when hashIp is true", () => {
      const ctx = createRequestContext({
        ...baseOptions,
        remoteAddress: "192.168.1.1",
        redaction: { hashIp: true, allowedHeaders: [] },
      });
      expect(ctx.clientIpHash).toBeDefined();
      expect(ctx.clientIpHash).not.toBe("192.168.1.1");
    });

    it("should not include clientIpHash when hashIp is false", () => {
      const ctx = createRequestContext({
        ...baseOptions,
        remoteAddress: "192.168.1.1",
        redaction: { hashIp: false, allowedHeaders: [] },
      });
      expect(ctx.clientIpHash).toBeUndefined();
    });

    it("should extract IP from x-forwarded-for header", () => {
      const ctx1 = createRequestContext({
        ...baseOptions,
        headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" },
        remoteAddress: "192.168.1.1",
        redaction: { hashIp: true, allowedHeaders: [] },
      });

      const ctx2 = createRequestContext({
        ...baseOptions,
        headers: {},
        remoteAddress: "10.0.0.1",
        redaction: { hashIp: true, allowedHeaders: [] },
      });

      // Both should produce the same hash since they use the same IP
      expect(ctx1.clientIpHash).toBe(ctx2.clientIpHash);
    });

    it("should not include clientIpHash when no IP available", () => {
      const ctx = createRequestContext({
        ...baseOptions,
        headers: {},
        redaction: { hashIp: true, allowedHeaders: [] },
      });
      expect(ctx.clientIpHash).toBeUndefined();
    });
  });

  describe("timer", () => {
    it("should create a timer", () => {
      const ctx = createRequestContext(baseOptions);
      expect(ctx.timer).toBeDefined();
      expect(typeof ctx.timer.elapsed).toBe("function");
    });

    it("should track elapsed time", async () => {
      const ctx = createRequestContext(baseOptions);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const elapsed = ctx.timer.elapsed();
      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some variance
    });
  });

  describe("sampling flag", () => {
    it("should preserve sampled flag", () => {
      const sampledCtx = createRequestContext({
        ...baseOptions,
        sampled: true,
      });
      const unsampledCtx = createRequestContext({
        ...baseOptions,
        sampled: false,
      });
      expect(sampledCtx.sampled).toBe(true);
      expect(unsampledCtx.sampled).toBe(false);
    });
  });
});

describe("captureResponseData", () => {
  it("should capture status code", () => {
    const ctx = createRequestContext({
      method: "GET",
      path: "/test",
      headers: {},
      redaction: { hashIp: true, allowedHeaders: [] },
      sampled: true,
    });

    const responseData = captureResponseData(ctx, 200);
    expect(responseData.statusCode).toBe(200);
  });

  it("should capture latency from timer", async () => {
    const ctx = createRequestContext({
      method: "GET",
      path: "/test",
      headers: {},
      redaction: { hashIp: true, allowedHeaders: [] },
      sampled: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    const responseData = captureResponseData(ctx, 200);

    expect(responseData.latencyMs).toBeGreaterThanOrEqual(40);
  });

  it("should handle various status codes", () => {
    const ctx = createRequestContext({
      method: "GET",
      path: "/test",
      headers: {},
      redaction: { hashIp: true, allowedHeaders: [] },
      sampled: true,
    });

    const statusCodes = [200, 201, 400, 401, 402, 404, 500, 502];
    for (const code of statusCodes) {
      const responseData = captureResponseData(ctx, code);
      expect(responseData.statusCode).toBe(code);
    }
  });
});
