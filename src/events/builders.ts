import { randomUUID } from "node:crypto";
import type { RequestContext, ResponseData } from "../core/index.js";
import { getTimestamp } from "../core/timing.js";
import { SDK_NAME, SDK_VERSION } from "../index.js";
import type { X402Metadata } from "../x402/index.js";
import type { AnalyticsEvent } from "./schema.js";
import { EventType, PaymentStatus } from "./types.js";

/**
 * Common base for event building
 */
function createBaseEvent(
  eventType: EventType,
  context: RequestContext
): AnalyticsEvent {
  return {
    schemaVersion: "1.0",
    eventId: randomUUID(),
    eventType,
    timestamp: getTimestamp(),
    request: {
      id: context.id,
      method: context.method,
      path: context.path,
      clientIpHash: context.clientIpHash,
      headers: context.headers,
    },
    sdk: {
      name: SDK_NAME,
      version: SDK_VERSION,
    },
  };
}

/**
 * Builds a request received event
 * @param context - Request context
 * @returns Analytics event
 */
export function buildRequestReceivedEvent(
  context: RequestContext
): AnalyticsEvent {
  return createBaseEvent(EventType.REQUEST_RECEIVED, context);
}

/**
 * Builds a payment required event
 * @param context - Request context
 * @param payment - x402 metadata
 * @param response - Response data
 * @returns Analytics event
 */
export function buildPaymentRequiredEvent(
  context: RequestContext,
  payment: X402Metadata,
  response: ResponseData
): AnalyticsEvent {
  const event = createBaseEvent(EventType.PAYMENT_REQUIRED, context);

  event.request.statusCode = response.statusCode;
  event.request.latencyMs = response.latencyMs;

  event.payment = {
    isRequired: payment.isPaymentRequired,
    address: payment.paymentAddress,
    amount: payment.paymentAmount,
    network: payment.paymentNetwork,
    token: payment.paymentToken,
    status: payment.paymentStatus ?? PaymentStatus.REQUIRED,
  };

  return event;
}

/**
 * Builds a request completed event
 * @param context - Request context
 * @param response - Response data
 * @param payment - Optional x402 metadata if present in response
 * @returns Analytics event
 */
export function buildRequestCompletedEvent(
  context: RequestContext,
  response: ResponseData,
  payment?: X402Metadata
): AnalyticsEvent {
  const event = createBaseEvent(EventType.REQUEST_COMPLETED, context);

  event.request.statusCode = response.statusCode;
  event.request.latencyMs = response.latencyMs;

  if (payment) {
    event.payment = {
      isRequired: payment.isPaymentRequired,
      address: payment.paymentAddress,
      amount: payment.paymentAmount,
      network: payment.paymentNetwork,
      token: payment.paymentToken,
      status: payment.paymentStatus,
    };
  }

  return event;
}

/**
 * Builds a payment verified event
 * @param context - Request context
 * @param payment - x402 metadata
 * @param response - Response data
 * @returns Analytics event
 */
export function buildPaymentVerifiedEvent(
  context: RequestContext,
  payment: X402Metadata,
  response: ResponseData
): AnalyticsEvent {
  const event = createBaseEvent(EventType.PAYMENT_VERIFIED, context);

  event.request.statusCode = response.statusCode;
  event.request.latencyMs = response.latencyMs;

  event.payment = {
    isRequired: payment.isPaymentRequired,
    address: payment.paymentAddress,
    amount: payment.paymentAmount,
    network: payment.paymentNetwork,
    token: payment.paymentToken,
    status: PaymentStatus.VERIFIED,
  };

  return event;
}

/**
 * Builds a payment failed event
 * @param context - Request context
 * @param payment - x402 metadata
 * @param response - Response data
 * @returns Analytics event
 */
export function buildPaymentFailedEvent(
  context: RequestContext,
  payment: X402Metadata,
  response: ResponseData
): AnalyticsEvent {
  const event = createBaseEvent(EventType.PAYMENT_FAILED, context);

  event.request.statusCode = response.statusCode;
  event.request.latencyMs = response.latencyMs;

  event.payment = {
    isRequired: payment.isPaymentRequired,
    address: payment.paymentAddress,
    amount: payment.paymentAmount,
    network: payment.paymentNetwork,
    token: payment.paymentToken,
    status: PaymentStatus.FAILED,
  };

  return event;
}
