import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  parseConfig,
  type SdkConfigInput,
  SdkConfigSchema,
  safeParseConfig,
} from "./config.js";

describe("SdkConfigSchema", () => {
  describe("apiKey validation", () => {
    it("should require apiKey", () => {
      const input = {};
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject empty apiKey", () => {
      const input = { apiKey: "" };
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should accept valid apiKey", () => {
      const input = { apiKey: "test-api-key" };
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("endpoint validation", () => {
    it("should reject invalid URL", () => {
      const input = { apiKey: "test-key", endpoint: "not-a-url" };
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should accept valid URL", () => {
      const input = { apiKey: "test-key", endpoint: "https://example.com/api" };
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("transport validation", () => {
    it("should reject batchSize below minimum", () => {
      const input = { apiKey: "test-key", transport: { batchSize: 0 } };
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject batchSize above maximum", () => {
      const input = { apiKey: "test-key", transport: { batchSize: 101 } };
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should accept valid batchSize", () => {
      const input = { apiKey: "test-key", transport: { batchSize: 50 } };
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject flushIntervalMs below minimum", () => {
      const input = { apiKey: "test-key", transport: { flushIntervalMs: 50 } };
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject flushIntervalMs above maximum", () => {
      const input = {
        apiKey: "test-key",
        transport: { flushIntervalMs: 31_000 },
      };
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject maxRetries above maximum", () => {
      const input = { apiKey: "test-key", transport: { maxRetries: 6 } };
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject timeoutMs below minimum", () => {
      const input = { apiKey: "test-key", transport: { timeoutMs: 500 } };
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("sampleRate validation", () => {
    it("should reject sampleRate below 0", () => {
      const input = { apiKey: "test-key", sampleRate: -0.1 };
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject sampleRate above 1", () => {
      const input = { apiKey: "test-key", sampleRate: 1.1 };
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should accept valid sampleRate", () => {
      const input = { apiKey: "test-key", sampleRate: 0.5 };
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("redaction validation", () => {
    it("should accept allowedHeaders array", () => {
      const input = {
        apiKey: "test-key",
        redaction: { allowedHeaders: ["x-custom-header"] },
      };
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject empty ipHashSalt", () => {
      const input = {
        apiKey: "test-key",
        redaction: { ipHashSalt: "" },
      };
      const result = SdkConfigSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe("parseConfig", () => {
  it("should apply default endpoint", () => {
    const input: SdkConfigInput = { apiKey: "test-key" };
    const config = parseConfig(input);
    expect(config.endpoint).toBe("https://api.ledgergate.io/v1/events");
  });

  it("should apply default sampleRate", () => {
    const input: SdkConfigInput = { apiKey: "test-key" };
    const config = parseConfig(input);
    expect(config.sampleRate).toBe(1);
  });

  it("should apply default debug mode", () => {
    const input: SdkConfigInput = { apiKey: "test-key" };
    const config = parseConfig(input);
    expect(config.debug).toBe(false);
  });

  it("should apply default redaction settings", () => {
    const input: SdkConfigInput = { apiKey: "test-key" };
    const config = parseConfig(input);
    expect(config.redaction.hashIp).toBe(true);
    expect(config.redaction.allowedHeaders).toEqual([]);
  });

  it("should apply default transport settings", () => {
    const input: SdkConfigInput = { apiKey: "test-key" };
    const config = parseConfig(input);
    expect(config.transport.batchSize).toBe(10);
    expect(config.transport.flushIntervalMs).toBe(5000);
    expect(config.transport.maxRetries).toBe(3);
    expect(config.transport.timeoutMs).toBe(10_000);
  });

  it("should override defaults with provided values", () => {
    const input: SdkConfigInput = {
      apiKey: "test-key",
      endpoint: "https://custom.example.com",
      sampleRate: 0.5,
      debug: true,
      redaction: {
        hashIp: false,
        allowedHeaders: ["x-custom"],
      },
      transport: {
        batchSize: 20,
        flushIntervalMs: 10_000,
        maxRetries: 5,
        timeoutMs: 15_000,
      },
    };
    const config = parseConfig(input);

    expect(config.endpoint).toBe("https://custom.example.com");
    expect(config.sampleRate).toBe(0.5);
    expect(config.debug).toBe(true);
    expect(config.redaction.hashIp).toBe(false);
    expect(config.redaction.allowedHeaders).toEqual(["x-custom"]);
    expect(config.transport.batchSize).toBe(20);
    expect(config.transport.flushIntervalMs).toBe(10_000);
    expect(config.transport.maxRetries).toBe(5);
    expect(config.transport.timeoutMs).toBe(15_000);
  });

  it("should throw ZodError for invalid input", () => {
    const input = { apiKey: "" };
    expect(() => parseConfig(input)).toThrow(ZodError);
  });

  it("should include ipHashSalt when provided", () => {
    const input: SdkConfigInput = {
      apiKey: "test-key",
      redaction: { ipHashSalt: "my-custom-salt" },
    };
    const config = parseConfig(input);
    expect(config.redaction.ipHashSalt).toBe("my-custom-salt");
  });

  it("should default excludePaths to empty array", () => {
    const input: SdkConfigInput = { apiKey: "test-key" };
    const config = parseConfig(input);
    expect(config.excludePaths).toEqual([]);
  });

  it("should preserve provided excludePaths", () => {
    const input: SdkConfigInput = {
      apiKey: "test-key",
      excludePaths: ["/favicon.ico", "/health/*"],
    };
    const config = parseConfig(input);
    expect(config.excludePaths).toEqual(["/favicon.ico", "/health/*"]);
  });
});

describe("safeParseConfig", () => {
  it("should return success with valid input", () => {
    const input = { apiKey: "test-key" };
    const result = safeParseConfig(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.apiKey).toBe("test-key");
    }
  });

  it("should return error with invalid input", () => {
    const input = { apiKey: "" };
    const result = safeParseConfig(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
    }
  });

  it("should apply defaults on success", () => {
    const input = { apiKey: "test-key" };
    const result = safeParseConfig(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.endpoint).toBe("https://api.ledgergate.io/v1/events");
      expect(result.data.sampleRate).toBe(1);
      expect(result.data.debug).toBe(false);
    }
  });

  it("should handle completely invalid input", () => {
    const result = safeParseConfig(null);
    expect(result.success).toBe(false);
  });

  it("should handle non-object input", () => {
    const result = safeParseConfig("not an object");
    expect(result.success).toBe(false);
  });
});
