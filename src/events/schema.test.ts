import { describe, expect, it } from "vitest";
import { AnalyticsEventSchema } from "./schema.js";
import { EventType, PaymentStatus } from "./types.js";

describe("AnalyticsEventSchema", () => {
  const validEvent = {
    schemaVersion: "1.0" as const,
    eventId: "550e8400-e29b-41d4-a716-446655440000",
    eventType: EventType.REQUEST_RECEIVED,
    timestamp: "2024-01-15T12:00:00.000Z",
    request: {
      id: "550e8400-e29b-41d4-a716-446655440001",
      method: "GET",
      path: "/api/test",
    },
    sdk: {
      name: "ledgergate-sdk",
      version: "1.0.0",
    },
  };

  describe("schemaVersion validation", () => {
    it("should accept schemaVersion 1.0", () => {
      const result = AnalyticsEventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
    });

    it("should reject invalid schemaVersion", () => {
      const event = { ...validEvent, schemaVersion: "2.0" };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });
  });

  describe("eventId validation", () => {
    it("should accept valid UUID", () => {
      const result = AnalyticsEventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const event = { ...validEvent, eventId: "not-a-uuid" };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });
  });

  describe("eventType validation", () => {
    it("should accept all valid event types", () => {
      const eventTypes = Object.values(EventType);
      for (const eventType of eventTypes) {
        const event = { ...validEvent, eventType };
        const result = AnalyticsEventSchema.safeParse(event);
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid event type", () => {
      const event = { ...validEvent, eventType: "invalid.event" };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });
  });

  describe("timestamp validation", () => {
    it("should accept ISO 8601 timestamp", () => {
      const result = AnalyticsEventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
    });

    it("should reject invalid timestamp format", () => {
      const event = { ...validEvent, timestamp: "2024-01-15 12:00:00" };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });
  });

  describe("request object validation", () => {
    it("should require request.id as UUID", () => {
      const event = {
        ...validEvent,
        request: { ...validEvent.request, id: "not-a-uuid" },
      };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    it("should require request.method", () => {
      const event = {
        ...validEvent,
        request: { id: validEvent.request.id, path: "/test" },
      };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    it("should require request.path", () => {
      const event = {
        ...validEvent,
        request: { id: validEvent.request.id, method: "GET" },
      };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    it("should accept optional statusCode", () => {
      const event = {
        ...validEvent,
        request: { ...validEvent.request, statusCode: 200 },
      };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it("should accept optional latencyMs", () => {
      const event = {
        ...validEvent,
        request: { ...validEvent.request, latencyMs: 150.5 },
      };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it("should accept optional clientIpHash", () => {
      const event = {
        ...validEvent,
        request: { ...validEvent.request, clientIpHash: "abc123def456" },
      };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it("should accept optional headers", () => {
      const event = {
        ...validEvent,
        request: {
          ...validEvent.request,
          headers: { "content-type": "application/json" },
        },
      };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe("payment object validation", () => {
    it("should accept valid payment object", () => {
      const event = {
        ...validEvent,
        payment: {
          isRequired: true,
          address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
          amount: "1000",
          network: "bitcoin",
          token: "BTC",
          status: PaymentStatus.REQUIRED,
        },
      };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it("should require isRequired in payment object", () => {
      const event = {
        ...validEvent,
        payment: {
          address: "addr123",
        },
      };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    it("should accept minimal payment object", () => {
      const event = {
        ...validEvent,
        payment: {
          isRequired: true,
        },
      };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it("should accept all valid payment status values", () => {
      const statuses = Object.values(PaymentStatus);
      for (const status of statuses) {
        const event = {
          ...validEvent,
          payment: {
            isRequired: true,
            status,
          },
        };
        const result = AnalyticsEventSchema.safeParse(event);
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid payment status", () => {
      const event = {
        ...validEvent,
        payment: {
          isRequired: true,
          status: "invalid",
        },
      };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    it("payment object should be optional", () => {
      const event = { ...validEvent };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe("sdk object validation", () => {
    it("should require sdk.name", () => {
      const event = {
        ...validEvent,
        sdk: { version: "0.1.0" },
      };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    it("should require sdk.version", () => {
      const event = {
        ...validEvent,
        sdk: { name: "ledgergate-sdk" },
      };
      const result = AnalyticsEventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });
  });

  describe("complete event validation", () => {
    it("should validate a complete event with all fields", () => {
      const completeEvent = {
        schemaVersion: "1.0" as const,
        eventId: "550e8400-e29b-41d4-a716-446655440000",
        eventType: EventType.PAYMENT_REQUIRED,
        timestamp: "2024-01-15T12:00:00.000Z",
        request: {
          id: "550e8400-e29b-41d4-a716-446655440001",
          method: "POST",
          path: "/api/premium",
          statusCode: 402,
          latencyMs: 45.5,
          clientIpHash: "abc123def456gh78",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
        },
        payment: {
          isRequired: true,
          address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
          amount: "1000",
          network: "bitcoin",
          token: "SATS",
          status: PaymentStatus.REQUIRED,
        },
        sdk: {
          name: "ledgergate-sdk",
          version: "1.0.0",
        },
      };

      const result = AnalyticsEventSchema.safeParse(completeEvent);
      expect(result.success).toBe(true);
    });
  });
});

describe("EventType", () => {
  it("should have all expected event types", () => {
    expect(EventType.REQUEST_RECEIVED).toBe("request.received");
    expect(EventType.PAYMENT_REQUIRED).toBe("payment.required");
    expect(EventType.PAYMENT_VERIFIED).toBe("payment.verified");
    expect(EventType.PAYMENT_FAILED).toBe("payment.failed");
    expect(EventType.REQUEST_COMPLETED).toBe("request.completed");
  });
});

describe("PaymentStatus", () => {
  it("should have all expected payment statuses", () => {
    expect(PaymentStatus.REQUIRED).toBe("required");
    expect(PaymentStatus.VERIFIED).toBe("verified");
    expect(PaymentStatus.FAILED).toBe("failed");
  });
});
