import { z } from "zod";

/**
 * Default redaction configuration values
 */
const DEFAULT_REDACTION = {
  hashIp: true,
  allowedHeaders: [] as string[],
} as const;

/**
 * Default transport configuration values
 */
const DEFAULT_TRANSPORT = {
  batchSize: 10,
  flushIntervalMs: 5000,
  maxRetries: 3,
  timeoutMs: 10_000,
} as const;

/**
 * Redaction configuration schema
 */
export const RedactionConfigSchema = z.object({
  /** Whether to hash IP addresses (default: true) */
  hashIp: z.boolean().optional(),
  /** Headers allowed to pass through without redaction */
  allowedHeaders: z.array(z.string()).optional(),
});

/**
 * Transport configuration schema
 */
export const TransportConfigSchema = z.object({
  /** Number of events to batch before sending (1-100, default: 10) */
  batchSize: z.number().int().min(1).max(100).optional(),
  /** Interval in ms to flush events (100-30000, default: 5000) */
  flushIntervalMs: z.number().int().min(100).max(30_000).optional(),
  /** Maximum retry attempts (0-5, default: 3) */
  maxRetries: z.number().int().min(0).max(5).optional(),
  /** HTTP request timeout in ms (1000-30000, default: 10000) */
  timeoutMs: z.number().int().min(1000).max(30_000).optional(),
});

/**
 * SDK configuration schema
 * Validates and provides defaults for all SDK options
 */
export const SdkConfigSchema = z.object({
  /** API key for authentication with the analytics endpoint */
  apiKey: z.string().min(1, "apiKey is required"),

  /** Analytics endpoint URL */
  endpoint: z.string().url("endpoint must be a valid URL").optional(),

  /** Privacy and redaction controls */
  redaction: RedactionConfigSchema.optional(),

  /** Transport and delivery settings */
  transport: TransportConfigSchema.optional(),

  /** Sampling rate (0-1, default: 1 = 100%) */
  sampleRate: z.number().min(0).max(1).optional(),

  /** Enable debug logging to console */
  debug: z.boolean().optional(),
});

/**
 * Input type for SDK configuration (before defaults are applied)
 */
export type SdkConfigInput = z.input<typeof SdkConfigSchema>;

/**
 * Resolved redaction configuration with defaults applied
 */
export interface RedactionConfig {
  readonly hashIp: boolean;
  readonly allowedHeaders: readonly string[];
}

/**
 * Resolved transport configuration with defaults applied
 */
export interface TransportConfig {
  readonly batchSize: number;
  readonly flushIntervalMs: number;
  readonly maxRetries: number;
  readonly timeoutMs: number;
}

/**
 * Fully resolved SDK configuration (after defaults are applied)
 */
export interface SdkConfig {
  readonly apiKey: string;
  readonly endpoint: string;
  readonly redaction: RedactionConfig;
  readonly transport: TransportConfig;
  readonly sampleRate: number;
  readonly debug: boolean;
}

/**
 * Applies defaults to redaction configuration
 */
function applyRedactionDefaults(
  input: z.output<typeof RedactionConfigSchema> | undefined
): RedactionConfig {
  return {
    hashIp: input?.hashIp ?? DEFAULT_REDACTION.hashIp,
    allowedHeaders: input?.allowedHeaders ?? [
      ...DEFAULT_REDACTION.allowedHeaders,
    ],
  };
}

/**
 * Applies defaults to transport configuration
 */
function applyTransportDefaults(
  input: z.output<typeof TransportConfigSchema> | undefined
): TransportConfig {
  return {
    batchSize: input?.batchSize ?? DEFAULT_TRANSPORT.batchSize,
    flushIntervalMs:
      input?.flushIntervalMs ?? DEFAULT_TRANSPORT.flushIntervalMs,
    maxRetries: input?.maxRetries ?? DEFAULT_TRANSPORT.maxRetries,
    timeoutMs: input?.timeoutMs ?? DEFAULT_TRANSPORT.timeoutMs,
  };
}

/**
 * Parses and validates SDK configuration
 * @param input - Raw configuration input
 * @returns Validated configuration with defaults applied
 * @throws ZodError if validation fails
 */
export function parseConfig(input: SdkConfigInput): SdkConfig {
  const parsed = SdkConfigSchema.parse(input);
  return {
    apiKey: parsed.apiKey,
    endpoint: parsed.endpoint ?? "https://api.tollgate.io/v1/events",
    redaction: applyRedactionDefaults(parsed.redaction),
    transport: applyTransportDefaults(parsed.transport),
    sampleRate: parsed.sampleRate ?? 1,
    debug: parsed.debug ?? false,
  };
}

/**
 * Safely parses SDK configuration without throwing
 * @param input - Raw configuration input
 * @returns Result object with success status and data or error
 */
export function safeParseConfig(
  input: unknown
): { success: true; data: SdkConfig } | { success: false; error: z.ZodError } {
  const result = SdkConfigSchema.safeParse(input);
  if (result.success) {
    return {
      success: true,
      data: {
        apiKey: result.data.apiKey,
        endpoint: result.data.endpoint ?? "https://api.tollgate.io/v1/events",
        redaction: applyRedactionDefaults(result.data.redaction),
        transport: applyTransportDefaults(result.data.transport),
        sampleRate: result.data.sampleRate ?? 1,
        debug: result.data.debug ?? false,
      },
    };
  }
  return { success: false, error: result.error };
}
