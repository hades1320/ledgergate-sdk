import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestContext, ResponseData } from "../core/context.js";
import type { X402Metadata } from "../x402/types.js";
import {
  buildPaymentFailedEvent,
  buildPaymentRequiredEvent,
  buildPaymentVerifiedEvent,
  buildRequestCompletedEvent,
  buildRequestReceivedEvent,
} from "./builders.js";
import { AnalyticsEventSchema } from "./schema.js";
import { EventType, PaymentStatus } from "./types.js";

describe("Event Builders", () => {
  // Mock timer that returns consistent elapsed time
  const mockTimer = {
    elapsed: () => 100,
  };

  const baseContext: RequestContext = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    timer: mockTimer,
    method: "GET",
    path: "/api/test",
    headers: { "content-type": "application/json" },
    sampled: true,
  };

  const contextWithIp: RequestContext = {
    ...baseContext,
    clientIpHash: "abc123def456gh78",
  };

  const responseData: ResponseData = {
    statusCode: 200,
    latencyMs: 150.5,
  };

  const paymentMetadata: X402Metadata = {
    isPaymentRequired: true,
    paymentAddress: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    paymentAmount: "1000",
    paymentNetwork: "bitcoin",
    paymentToken: "SATS",
    paymentStatus: "required",
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("buildRequestReceivedEvent", () => {
    it("should create valid request received event", () => {
      const event = buildRequestReceivedEvent(baseContext);

      expect(event.eventType).toBe(EventType.REQUEST_RECEIVED);
      expect(event.schemaVersion).toBe("1.0");
      expect(event.request.id).toBe(baseContext.id);
      expect(event.request.method).toBe("GET");
      expect(event.request.path).toBe("/api/test");
      expect(event.sdk.name).toBe("tollgate-sdk");
    });

    it("should generate unique eventId", () => {
      const event1 = buildRequestReceivedEvent(baseContext);
      const event2 = buildRequestReceivedEvent(baseContext);
      expect(event1.eventId).not.toBe(event2.eventId);
    });

    it("should include ISO 8601 timestamp", () => {
      const event = buildRequestReceivedEvent(baseContext);
      expect(event.timestamp).toBe("2024-01-15T12:00:00.000Z");
    });

    it("should include clientIpHash when present", () => {
      const event = buildRequestReceivedEvent(contextWithIp);
      expect(event.request.clientIpHash).toBe("abc123def456gh78");
    });

    it("should include headers", () => {
      const event = buildRequestReceivedEvent(baseContext);
      expect(event.request.headers).toEqual({
        "content-type": "application/json",
      });
    });

    it("should not include statusCode or latencyMs", () => {
      const event = buildRequestReceivedEvent(baseContext);
      expect(event.request.statusCode).toBeUndefined();
      expect(event.request.latencyMs).toBeUndefined();
    });

    it("should pass schema validation", () => {
      const event = buildRequestReceivedEvent(baseContext);
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe("buildPaymentRequiredEvent", () => {
    it("should create valid payment required event", () => {
      const event = buildPaymentRequiredEvent(baseContext, paymentMetadata, {
        statusCode: 402,
        latencyMs: 50,
      });

      expect(event.eventType).toBe(EventType.PAYMENT_REQUIRED);
      expect(event.request.statusCode).toBe(402);
      expect(event.request.latencyMs).toBe(50);
    });

    it("should include payment metadata", () => {
      const event = buildPaymentRequiredEvent(baseContext, paymentMetadata, {
        statusCode: 402,
        latencyMs: 50,
      });

      expect(event.payment).toBeDefined();
      expect(event.payment?.isRequired).toBe(true);
      expect(event.payment?.address).toBe(
        "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
      );
      expect(event.payment?.amount).toBe("1000");
      expect(event.payment?.network).toBe("bitcoin");
      expect(event.payment?.token).toBe("SATS");
      expect(event.payment?.status).toBe(PaymentStatus.REQUIRED);
    });

    it("should default to required status if not provided", () => {
      const metaWithoutStatus: X402Metadata = {
        isPaymentRequired: true,
        paymentAddress: "addr123",
      };
      const event = buildPaymentRequiredEvent(baseContext, metaWithoutStatus, {
        statusCode: 402,
        latencyMs: 50,
      });

      expect(event.payment?.status).toBe(PaymentStatus.REQUIRED);
    });

    it("should pass schema validation", () => {
      const event = buildPaymentRequiredEvent(baseContext, paymentMetadata, {
        statusCode: 402,
        latencyMs: 50,
      });
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe("buildRequestCompletedEvent", () => {
    it("should create valid request completed event", () => {
      const event = buildRequestCompletedEvent(baseContext, responseData);

      expect(event.eventType).toBe(EventType.REQUEST_COMPLETED);
      expect(event.request.statusCode).toBe(200);
      expect(event.request.latencyMs).toBe(150.5);
    });

    it("should not include payment when not provided", () => {
      const event = buildRequestCompletedEvent(baseContext, responseData);
      expect(event.payment).toBeUndefined();
    });

    it("should include payment when provided", () => {
      const event = buildRequestCompletedEvent(
        baseContext,
        responseData,
        paymentMetadata
      );

      expect(event.payment).toBeDefined();
      expect(event.payment?.isRequired).toBe(true);
    });

    it("should pass schema validation", () => {
      const event = buildRequestCompletedEvent(baseContext, responseData);
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it("should pass schema validation with payment", () => {
      const event = buildRequestCompletedEvent(
        baseContext,
        responseData,
        paymentMetadata
      );
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe("buildPaymentVerifiedEvent", () => {
    it("should create valid payment verified event", () => {
      const event = buildPaymentVerifiedEvent(
        baseContext,
        paymentMetadata,
        responseData
      );

      expect(event.eventType).toBe(EventType.PAYMENT_VERIFIED);
      expect(event.payment?.status).toBe(PaymentStatus.VERIFIED);
    });

    it("should always use VERIFIED status regardless of input", () => {
      const metaWithRequired: X402Metadata = {
        ...paymentMetadata,
        paymentStatus: "required",
      };
      const event = buildPaymentVerifiedEvent(
        baseContext,
        metaWithRequired,
        responseData
      );

      expect(event.payment?.status).toBe(PaymentStatus.VERIFIED);
    });

    it("should pass schema validation", () => {
      const event = buildPaymentVerifiedEvent(
        baseContext,
        paymentMetadata,
        responseData
      );
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe("buildPaymentFailedEvent", () => {
    it("should create valid payment failed event", () => {
      const event = buildPaymentFailedEvent(baseContext, paymentMetadata, {
        statusCode: 402,
        latencyMs: 30,
      });

      expect(event.eventType).toBe(EventType.PAYMENT_FAILED);
      expect(event.payment?.status).toBe(PaymentStatus.FAILED);
    });

    it("should always use FAILED status regardless of input", () => {
      const metaWithVerified: X402Metadata = {
        ...paymentMetadata,
        paymentStatus: "verified",
      };
      const event = buildPaymentFailedEvent(baseContext, metaWithVerified, {
        statusCode: 402,
        latencyMs: 30,
      });

      expect(event.payment?.status).toBe(PaymentStatus.FAILED);
    });

    it("should pass schema validation", () => {
      const event = buildPaymentFailedEvent(baseContext, paymentMetadata, {
        statusCode: 402,
        latencyMs: 30,
      });
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe("common event properties", () => {
    it("all builders should produce unique event IDs", () => {
      const eventIds = new Set([
        buildRequestReceivedEvent(baseContext).eventId,
        buildPaymentRequiredEvent(baseContext, paymentMetadata, responseData)
          .eventId,
        buildRequestCompletedEvent(baseContext, responseData).eventId,
        buildPaymentVerifiedEvent(baseContext, paymentMetadata, responseData)
          .eventId,
        buildPaymentFailedEvent(baseContext, paymentMetadata, responseData)
          .eventId,
      ]);

      expect(eventIds.size).toBe(5);
    });

    it("all builders should include SDK info", () => {
      const events = [
        buildRequestReceivedEvent(baseContext),
        buildPaymentRequiredEvent(baseContext, paymentMetadata, responseData),
        buildRequestCompletedEvent(baseContext, responseData),
        buildPaymentVerifiedEvent(baseContext, paymentMetadata, responseData),
        buildPaymentFailedEvent(baseContext, paymentMetadata, responseData),
      ];

      for (const event of events) {
        expect(event.sdk.name).toBe("tollgate-sdk");
        expect(event.sdk.version).toBeDefined();
      }
    });
  });
});
