/**
 * Supported event types in the SDK
 */
export const EventType = {
  /** Initial request received by the server */
  REQUEST_RECEIVED: "request.received",
  /** Response indicates payment is required (HTTP 402) */
  PAYMENT_REQUIRED: "payment.required",
  /** Payment was successfully verified */
  PAYMENT_VERIFIED: "payment.verified",
  /** Payment verification failed */
  PAYMENT_FAILED: "payment.failed",
  /** Final request completion event */
  REQUEST_COMPLETED: "request.completed",
} as const;

/**
 * Type representing one of the EventType values
 */
export type EventType = (typeof EventType)[keyof typeof EventType];

/**
 * Payment status for events
 */
export const PaymentStatus = {
  REQUIRED: "required",
  VERIFIED: "verified",
  FAILED: "failed",
} as const;

/**
 * Type representing one of the PaymentStatus values
 */
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
