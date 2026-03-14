import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { SdkConfig } from "../core/config.js";
import type { AnalyticsEvent } from "../events/schema.js";
import { EventType } from "../events/types.js";
import type { EventQueue } from "../transport/types.js";
import { fastifyLedgergate } from "./fastify.js";
import type { SdkInstance } from "./types.js";

function createTestSetup(overrides: Partial<SdkConfig> = {}) {
  const enqueuedEvents: AnalyticsEvent[] = [];

  const mockQueue: EventQueue = {
    enqueue: vi.fn((event: AnalyticsEvent) => {
      enqueuedEvents.push(event);
    }),
    flush: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    size: vi.fn().mockReturnValue(0),
  };

  const baseConfig: SdkConfig = {
    apiKey: "test-key",
    endpoint: "https://api.example.com/events",
    redaction: {
      hashIp: true,
      allowedHeaders: [],
    },
    transport: {
      batchSize: 10,
      flushIntervalMs: 5000,
      maxRetries: 3,
      timeoutMs: 10_000,
    },
    sampleRate: 1,
    debug: false,
    x402: {
      source: "header",
      fieldMapping: {
        address: "x-payment-address",
        amount: "x-payment-amount",
        network: "x-payment-network",
        token: "x-payment-token",
        status: "x-payment-status",
      },
    },
    excludePaths: [],
    ...overrides,
  };

  const mockSdk: SdkInstance = {
    config: baseConfig,
    queue: mockQueue,
    shutdown: vi.fn().mockResolvedValue(undefined),
  };

  return { enqueuedEvents, mockQueue, mockSdk };
}

describe("fastifyLedgergate", () => {
  describe("plugin registration", () => {
    it("should register without error", async () => {
      const { mockSdk } = createTestSetup();
      const app = Fastify({ logger: false });

      await app.register(fastifyLedgergate, { sdk: mockSdk });
      await expect(app.ready()).resolves.not.toThrow();
      await app.close();
    });

    it("should decorate request with x402Context", async () => {
      const { mockSdk } = createTestSetup();
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      let contextFound = false;
      app.get("/test", (request, reply) => {
        contextFound = request.x402Context !== undefined;
        reply.send({ ok: true });
      });

      await app.inject({ method: "GET", url: "/test" });
      expect(contextFound).toBe(true);
      await app.close();
    });
  });

  describe("request handling", () => {
    it("should emit request.received event", async () => {
      const { mockSdk, mockQueue, enqueuedEvents } = createTestSetup();
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      app.get("/test", (_request, reply) => {
        reply.send({ ok: true });
      });

      await app.inject({ method: "GET", url: "/test" });

      expect(mockQueue.enqueue).toHaveBeenCalled();
      expect(enqueuedEvents[0]).toMatchObject({
        eventType: EventType.REQUEST_RECEIVED,
      });
      await app.close();
    });

    it("should create context with correct method", async () => {
      const { mockSdk, enqueuedEvents } = createTestSetup();
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      app.post("/test", (_request, reply) => {
        reply.send({ ok: true });
      });

      await app.inject({ method: "POST", url: "/test" });

      expect(enqueuedEvents[0]).toMatchObject({
        request: { method: "POST" },
      });
      await app.close();
    });

    it("should create context with correct path", async () => {
      const { mockSdk, enqueuedEvents } = createTestSetup();
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      app.get("/api/users/123", (_request, reply) => {
        reply.send({ ok: true });
      });

      await app.inject({ method: "GET", url: "/api/users/123" });

      expect(enqueuedEvents[0]).toMatchObject({
        request: { path: "/api/users/123" },
      });
      await app.close();
    });
  });

  describe("response handling", () => {
    it("should emit request.completed event", async () => {
      const { mockSdk, mockQueue, enqueuedEvents } = createTestSetup();
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      app.get("/test", (_request, reply) => {
        reply.send({ ok: true });
      });

      await app.inject({ method: "GET", url: "/test" });

      expect(mockQueue.enqueue).toHaveBeenCalledTimes(2);
      expect(enqueuedEvents[1]).toMatchObject({
        eventType: EventType.REQUEST_COMPLETED,
      });
      await app.close();
    });

    it("should capture status code in response event", async () => {
      const { mockSdk, enqueuedEvents } = createTestSetup();
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      app.get("/test", (_request, reply) => {
        reply.code(201).send({ created: true });
      });

      await app.inject({ method: "GET", url: "/test" });

      expect(enqueuedEvents[1]).toMatchObject({
        request: { statusCode: 201 },
      });
      await app.close();
    });

    it("should capture error status codes", async () => {
      const { mockSdk, enqueuedEvents } = createTestSetup();
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      app.get("/error", (_request, reply) => {
        reply.code(500).send({ error: "Internal Server Error" });
      });

      await app.inject({ method: "GET", url: "/error" });

      expect(enqueuedEvents[1]).toMatchObject({
        request: { statusCode: 500 },
      });
      await app.close();
    });
  });

  describe("x402 detection", () => {
    it("should emit payment.required event for 402 responses", async () => {
      const { mockSdk, enqueuedEvents } = createTestSetup();
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      app.get("/premium", (_request, reply) => {
        reply
          .code(402)
          .header("x-payment-address", "addr123")
          .header("x-payment-amount", "1000")
          .send({ error: "Payment Required" });
      });

      await app.inject({ method: "GET", url: "/premium" });

      expect(enqueuedEvents[1]).toMatchObject({
        eventType: EventType.PAYMENT_REQUIRED,
        payment: {
          isRequired: true,
          address: "addr123",
          amount: "1000",
        },
      });
      await app.close();
    });

    it("should emit payment.verified event for verified status", async () => {
      const { mockSdk, enqueuedEvents } = createTestSetup();
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      app.get("/verified", (_request, reply) => {
        reply
          .code(200)
          .header("x-payment-status", "verified")
          .header("x-payment-address", "addr123")
          .send({ data: "premium content" });
      });

      await app.inject({ method: "GET", url: "/verified" });

      expect(enqueuedEvents.length).toBe(2);
      expect(enqueuedEvents[1]).toMatchObject({
        eventType: EventType.PAYMENT_VERIFIED,
      });
      await app.close();
    });

    it("should emit payment.failed event for failed status", async () => {
      const { mockSdk, enqueuedEvents } = createTestSetup();
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      // Use non-402 status since 402 takes precedence and emits PAYMENT_REQUIRED
      app.get("/failed", (_request, reply) => {
        reply
          .code(400)
          .header("x-payment-status", "failed")
          .header("x-payment-address", "addr123")
          .send({ error: "Payment Failed" });
      });

      await app.inject({ method: "GET", url: "/failed" });

      expect(enqueuedEvents.length).toBe(2);
      expect(enqueuedEvents[1]).toMatchObject({
        eventType: EventType.PAYMENT_FAILED,
      });
      await app.close();
    });
  });

  describe("sampling", () => {
    it("should not emit events when sampleRate is 0", async () => {
      const { mockSdk, mockQueue } = createTestSetup({ sampleRate: 0 });
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      app.get("/test", (_request, reply) => {
        reply.send({ ok: true });
      });

      await app.inject({ method: "GET", url: "/test" });

      expect(mockQueue.enqueue).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe("fail-open behavior", () => {
    it("should not break request handling if enqueue throws", async () => {
      const { mockSdk } = createTestSetup();
      mockSdk.queue.enqueue = vi.fn(() => {
        throw new Error("Queue error");
      });

      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      app.get("/test", (_request, reply) => {
        reply.send({ ok: true });
      });

      const response = await app.inject({ method: "GET", url: "/test" });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ ok: true });
      await app.close();
    });
  });

  describe("header redaction", () => {
    it("should redact authorization header", async () => {
      const { mockSdk } = createTestSetup();
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      let authHeaderValue = "";
      app.get("/test", (request, reply) => {
        authHeaderValue = request.x402Context?.headers.authorization ?? "";
        reply.send({ ok: true });
      });

      await app.inject({
        method: "GET",
        url: "/test",
        headers: { authorization: "Bearer secret-token" },
      });

      expect(authHeaderValue).toBe("[REDACTED]");
      await app.close();
    });

    it("should preserve non-sensitive headers", async () => {
      const { mockSdk } = createTestSetup();
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      let contentTypeValue = "";
      app.get("/test", (request, reply) => {
        contentTypeValue = request.x402Context?.headers["content-type"] ?? "";
        reply.send({ ok: true });
      });

      await app.inject({
        method: "GET",
        url: "/test",
        headers: { "content-type": "application/json" },
      });

      expect(contentTypeValue).toBe("application/json");
      await app.close();
    });
  });

  describe("context attachment", () => {
    it("should attach sampled flag to context", async () => {
      const { mockSdk } = createTestSetup();
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      let sampledValue = false;
      app.get("/test", (request, reply) => {
        sampledValue = request.x402Context?.sampled ?? false;
        reply.send({ ok: true });
      });

      await app.inject({ method: "GET", url: "/test" });

      expect(sampledValue).toBe(true);
      await app.close();
    });

    it("should generate unique request IDs", async () => {
      const { mockSdk } = createTestSetup();
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      const ids: string[] = [];
      app.get("/test", (request, reply) => {
        if (request.x402Context) {
          ids.push(request.x402Context.id);
        }
        reply.send({ ok: true });
      });

      await app.inject({ method: "GET", url: "/test" });
      await app.inject({ method: "GET", url: "/test" });
      await app.inject({ method: "GET", url: "/test" });

      expect(new Set(ids).size).toBe(3);
      await app.close();
    });
  });

  describe("path exclusion", () => {
    it("should skip excluded exact paths", async () => {
      const { mockSdk, mockQueue } = createTestSetup({
        excludePaths: ["/favicon.ico"],
      });
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      app.get("/favicon.ico", (_request, reply) => {
        reply.send({ ok: true });
      });

      await app.inject({ method: "GET", url: "/favicon.ico" });

      expect(mockQueue.enqueue).not.toHaveBeenCalled();
      await app.close();
    });

    it("should skip paths matching wildcard pattern", async () => {
      const { mockSdk, mockQueue } = createTestSetup({
        excludePaths: ["/health/*"],
      });
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      app.get("/health/live", (_request, reply) => {
        reply.send({ ok: true });
      });

      await app.inject({ method: "GET", url: "/health/live" });

      expect(mockQueue.enqueue).not.toHaveBeenCalled();
      await app.close();
    });

    it("should still track non-excluded paths when excludePaths is set", async () => {
      const { mockSdk, mockQueue } = createTestSetup({
        excludePaths: ["/favicon.ico"],
      });
      const app = Fastify({ logger: false });
      await app.register(fastifyLedgergate, { sdk: mockSdk });

      app.get("/api/data", (_request, reply) => {
        reply.send({ ok: true });
      });

      await app.inject({ method: "GET", url: "/api/data" });

      expect(mockQueue.enqueue).toHaveBeenCalled();
      await app.close();
    });
  });
});
