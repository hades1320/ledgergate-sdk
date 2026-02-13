import { z } from "zod";

/**
 * Source of payment metadata
 * - "header": Read from response headers only
 * - "body": Read from response body only
 * - "both": Read from both (headers take precedence)
 */
export type PaymentMetadataSource = "header" | "body" | "both";

/**
 * Custom key mapping for payment fields
 * Maps internal field names to actual header/body keys
 */
export interface PaymentFieldMapping {
  /** Key for payment address (default: "x-payment-address") */
  readonly address?: string;
  /** Key for payment amount (default: "x-payment-amount") */
  readonly amount?: string;
  /** Key for payment network (default: "x-payment-network") */
  readonly network?: string;
  /** Key for payment token (default: "x-payment-token") */
  readonly token?: string;
  /** Key for payment status (default: "x-payment-status") */
  readonly status?: string;
}

/**
 * X402 detection configuration
 */
export interface X402DetectionConfig {
  /** Where to look for payment metadata */
  readonly source: PaymentMetadataSource;
  /** Custom key mappings for payment fields */
  readonly fieldMapping: Required<PaymentFieldMapping>;
}

/**
 * Default field mapping - matches current hardcoded behavior
 */
export const DEFAULT_FIELD_MAPPING: Required<PaymentFieldMapping> = {
  address: "x-payment-address",
  amount: "x-payment-amount",
  network: "x-payment-network",
  token: "x-payment-token",
  status: "x-payment-status",
} as const;

/**
 * Default x402 detection configuration
 */
export const DEFAULT_X402_DETECTION_CONFIG: X402DetectionConfig = {
  source: "header",
  fieldMapping: DEFAULT_FIELD_MAPPING,
} as const;

/**
 * Zod schema for payment field mapping
 */
export const PaymentFieldMappingSchema = z.object({
  address: z.string().min(1).optional(),
  amount: z.string().min(1).optional(),
  network: z.string().min(1).optional(),
  token: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
});

/**
 * Zod schema for x402 detection configuration
 */
export const X402DetectionConfigSchema = z.object({
  source: z.enum(["header", "body", "both"]).optional(),
  fieldMapping: PaymentFieldMappingSchema.optional(),
});

/**
 * Applies defaults to x402 detection configuration
 * @param input - Optional user-provided configuration
 * @returns Fully resolved configuration with defaults
 */
export function applyX402DetectionDefaults(
  input: z.output<typeof X402DetectionConfigSchema> | undefined
): X402DetectionConfig {
  return {
    source: input?.source ?? DEFAULT_X402_DETECTION_CONFIG.source,
    fieldMapping: {
      address: input?.fieldMapping?.address ?? DEFAULT_FIELD_MAPPING.address,
      amount: input?.fieldMapping?.amount ?? DEFAULT_FIELD_MAPPING.amount,
      network: input?.fieldMapping?.network ?? DEFAULT_FIELD_MAPPING.network,
      token: input?.fieldMapping?.token ?? DEFAULT_FIELD_MAPPING.token,
      status: input?.fieldMapping?.status ?? DEFAULT_FIELD_MAPPING.status,
    },
  };
}
