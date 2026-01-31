import { z } from "zod";
import { EventType, PaymentStatus } from "./types.js";

/**
 * Zod schema for versioned analytics events
 */
export const AnalyticsEventSchema = z.object({
  /** Schema version for this event */
  schemaVersion: z.literal("1.0"),
  /** Unique ID for this specific event instance (UUID v4) */
  eventId: z.string().uuid(),
  /** Type of event being reported */
  eventType: z.enum(Object.values(EventType) as [string, ...string[]]),
  /** ISO 8601 timestamp of when the event occurred */
  timestamp: z.string().datetime(),

  /** Request metadata */
  request: z.object({
    /** Correlation ID for the request lifecycle */
    id: z.string().uuid(),
    /** HTTP method (uppercase) */
    method: z.string(),
    /** Normalized request path */
    path: z.string(),
    /** HTTP response status code (if available) */
    statusCode: z.number().int().optional(),
    /** Latency in milliseconds (if available) */
    latencyMs: z.number().optional(),
    /** Hashed client IP address (if available) */
    clientIpHash: z.string().optional(),
    /** Redacted request headers */
    headers: z.record(z.string(), z.string()).optional(),
  }),

  /** x402 payment metadata (if applicable) */
  payment: z
    .object({
      /** Whether payment was required for this request */
      isRequired: z.boolean(),
      /** Destination payment address */
      address: z.string().optional(),
      /** Requested payment amount */
      amount: z.string().optional(),
      /** Payment network (bitcoin, lightning, etc.) */
      network: z.string().optional(),
      /** Currency or token symbol (BTC, SATS, etc.) */
      token: z.string().optional(),
      /** Payment status (required, verified, failed) */
      status: z
        .enum(Object.values(PaymentStatus) as [string, ...string[]])
        .optional(),
    })
    .optional(),

  /** SDK metadata */
  sdk: z.object({
    /** SDK name (tollgate-sdk) */
    name: z.string(),
    /** SDK version */
    version: z.string(),
  }),
});

/**
 * Type representing a validated analytics event
 */
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;
