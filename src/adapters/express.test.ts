import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SdkConfig } from "../core/config.js";
import { EventType } from "../events/types.js";
import type { EventQueue } from "../transport/types.js";
import { createExpressMiddleware } from "./express.js";
import type { SdkInstance } from "./types.js";

// Create mock types for Express
interface MockRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

interface MockResponse {
  statusCode: number;
  locals: Record<string, unknown>;
  on: (event: string, callback: () => void) => void;
  getHeaders: () => Record<string, string | string[] | undefined>;
}

describe("createExpressMiddleware", () => {
  let mockQueue: EventQueue;
  let mockSdk: SdkInstance;
  let enqueuedEvents: unknown[];
  let responseFinishHandler: (() => void) | undefined;

  const createMockRequest = (
    overrides: Partial<MockRequest> = {}
  ): MockRequest => ({
    method: "GET",
    path: "/api/test",
    headers: {
      "content-type": "application/json",
      "user-agent": "test-agent",
    },
    ...overrides,
  });

  const createMockResponse = (
    overrides: Partial<MockResponse> = {}
  ): MockResponse => ({
    statusCode: 200,
    locals: {},
    on: (event: string, callback: () => void) => {
      if (event === "finish") {
        responseFinishHandler = callback;
      }
    },
    getHeaders: () => ({}),
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));

    enqueuedEvents = [];
    responseFinishHandler = undefined;

    mockQueue = {
      enqueue: vi.fn((event) => {
        enqueuedEvents.push(event);
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      size: vi.fn().mockReturnValue(0),
    };

    const mockConfig: SdkConfig = {
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
    };

    mockSdk = {
      config: mockConfig,
      queue: mockQueue,
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("middleware creation", () => {
    it("should return a function", () => {
      const middleware = createExpressMiddleware(mockSdk);
      expect(typeof middleware).toBe("function");
    });
  });

  describe("request handling", () => {
    it("should call next() to pass control", () => {
      const middleware = createExpressMiddleware(mockSdk);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should emit request.received event", () => {
      const middleware = createExpressMiddleware(mockSdk);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      expect(mockQueue.enqueue).toHaveBeenCalledTimes(1);
      expect(enqueuedEvents[0]).toMatchObject({
        eventType: EventType.REQUEST_RECEIVED,
      });
    });

    it("should attach context to res.locals", () => {
      const middleware = createExpressMiddleware(mockSdk);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      expect(res.locals.x402Context).toBeDefined();
      expect(res.locals.x402Context).toHaveProperty("id");
      expect(res.locals.x402Context).toHaveProperty("method", "GET");
      expect(res.locals.x402Context).toHaveProperty("path", "/api/test");
    });

    it("should register finish handler on response", () => {
      const middleware = createExpressMiddleware(mockSdk);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      expect(responseFinishHandler).toBeDefined();
    });
  });

  describe("response handling", () => {
    it("should emit request.completed event on finish", () => {
      const middleware = createExpressMiddleware(mockSdk);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      // Simulate response finish
      if (responseFinishHandler) {
        responseFinishHandler();
      }

      expect(mockQueue.enqueue).toHaveBeenCalledTimes(2);
      expect(enqueuedEvents[1]).toMatchObject({
        eventType: EventType.REQUEST_COMPLETED,
        request: {
          statusCode: 200,
        },
      });
    });

    it("should capture latency in response event", async () => {
      const middleware = createExpressMiddleware(mockSdk);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      // Advance time to simulate latency
      await vi.advanceTimersByTimeAsync(100);

      if (responseFinishHandler) {
        responseFinishHandler();
      }

      const completedEvent = enqueuedEvents[1] as {
        request: { latencyMs: number };
      };
      expect(completedEvent.request.latencyMs).toBeGreaterThanOrEqual(90);
    });
  });

  describe("x402 detection", () => {
    it("should emit payment.required event for 402 responses", () => {
      const middleware = createExpressMiddleware(mockSdk);
      const req = createMockRequest();
      const res = createMockResponse({
        statusCode: 402,
        getHeaders: () => ({
          "x-payment-address": "addr123",
          "x-payment-amount": "1000",
        }),
      });
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      if (responseFinishHandler) {
        responseFinishHandler();
      }

      expect(enqueuedEvents[1]).toMatchObject({
        eventType: EventType.PAYMENT_REQUIRED,
        payment: {
          isRequired: true,
          address: "addr123",
          amount: "1000",
        },
      });
    });

    it("should emit payment.verified event for verified status", () => {
      const middleware = createExpressMiddleware(mockSdk);
      const req = createMockRequest();
      const res = createMockResponse({
        statusCode: 200,
        getHeaders: () => ({
          "x-payment-status": "verified",
          "x-payment-address": "addr123",
        }),
      });
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      if (responseFinishHandler) {
        responseFinishHandler();
      }

      expect(enqueuedEvents[1]).toMatchObject({
        eventType: EventType.PAYMENT_VERIFIED,
      });
    });

    it("should emit payment.failed event for failed status", () => {
      const middleware = createExpressMiddleware(mockSdk);
      const req = createMockRequest();
      // Use non-402 status since 402 takes precedence and emits PAYMENT_REQUIRED
      const res = createMockResponse({
        statusCode: 400,
        getHeaders: () => ({
          "x-payment-status": "failed",
          "x-payment-address": "addr123",
        }),
      });
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      if (responseFinishHandler) {
        responseFinishHandler();
      }

      expect(enqueuedEvents[1]).toMatchObject({
        eventType: EventType.PAYMENT_FAILED,
      });
    });
  });

  describe("sampling", () => {
    it("should not emit events when not sampled", () => {
      const lowSampleSdk: SdkInstance = {
        ...mockSdk,
        config: {
          ...mockSdk.config,
          sampleRate: 0,
        },
      };

      const middleware = createExpressMiddleware(lowSampleSdk);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      if (responseFinishHandler) {
        responseFinishHandler();
      }

      expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });

    it("should still call next() when not sampled", () => {
      const lowSampleSdk: SdkInstance = {
        ...mockSdk,
        config: {
          ...mockSdk.config,
          sampleRate: 0,
        },
      };

      const middleware = createExpressMiddleware(lowSampleSdk);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("fail-open behavior", () => {
    it("should call next() even if SDK throws", () => {
      const errorQueue = {
        ...mockQueue,
        enqueue: vi.fn(() => {
          throw new Error("Queue error");
        }),
      };

      const errorSdk: SdkInstance = {
        ...mockSdk,
        queue: errorQueue,
      };

      const middleware = createExpressMiddleware(errorSdk);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      // Should not throw
      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should log error in debug mode", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // Do nothing
      });

      const errorQueue = {
        ...mockQueue,
        enqueue: vi.fn(() => {
          throw new Error("Queue error");
        }),
      };

      const errorSdk: SdkInstance = {
        ...mockSdk,
        config: { ...mockSdk.config, debug: true },
        queue: errorQueue,
      };

      const middleware = createExpressMiddleware(errorSdk);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error in middleware"),
        expect.any(Error)
      );
    });
  });

  describe("header handling", () => {
    it("should redact sensitive headers", () => {
      const middleware = createExpressMiddleware(mockSdk);
      const req = createMockRequest({
        headers: {
          "content-type": "application/json",
          authorization: "Bearer secret-token",
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      const context = res.locals.x402Context as {
        headers: Record<string, string>;
      };
      expect(context.headers.authorization).toBe("[REDACTED]");
      expect(context.headers["content-type"]).toBe("application/json");
    });
  });

  describe("IP handling", () => {
    it("should hash client IP when available", () => {
      const middleware = createExpressMiddleware(mockSdk);
      const req = createMockRequest();
      (req as MockRequest & { ip: string }).ip = "192.168.1.1";
      const res = createMockResponse();
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      const context = res.locals.x402Context as { clientIpHash?: string };
      expect(context.clientIpHash).toBeDefined();
      expect(context.clientIpHash).not.toBe("192.168.1.1");
    });
  });

  describe("path exclusion", () => {
    it("should not track excluded exact paths", () => {
      const excludeSdk: SdkInstance = {
        ...mockSdk,
        config: { ...mockSdk.config, excludePaths: ["/favicon.ico"] },
      };
      const middleware = createExpressMiddleware(excludeSdk);
      const req = createMockRequest({ path: "/favicon.ico" });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      expect(mockQueue.enqueue).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should not track paths matching wildcard pattern", () => {
      const excludeSdk: SdkInstance = {
        ...mockSdk,
        config: { ...mockSdk.config, excludePaths: ["/static/*"] },
      };
      const middleware = createExpressMiddleware(excludeSdk);
      const req = createMockRequest({ path: "/static/logo.png" });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      expect(mockQueue.enqueue).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should still track non-excluded paths when excludePaths is set", () => {
      const excludeSdk: SdkInstance = {
        ...mockSdk,
        config: { ...mockSdk.config, excludePaths: ["/favicon.ico"] },
      };
      const middleware = createExpressMiddleware(excludeSdk);
      const req = createMockRequest({ path: "/api/test" });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(
        req as unknown as Parameters<typeof middleware>[0],
        res as unknown as Parameters<typeof middleware>[1],
        next
      );

      expect(mockQueue.enqueue).toHaveBeenCalledTimes(1);
    });
  });
});
