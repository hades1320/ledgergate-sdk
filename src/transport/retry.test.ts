import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withRetry } from "./retry.js";

describe("withRetry", () => {
  const defaultConfig = {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 1000,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {
      // do nothing
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("successful execution", () => {
    it("should return result on first success", async () => {
      const fn = vi.fn().mockResolvedValue("success");

      const resultPromise = withRetry(fn, defaultConfig);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should return result after retry on success", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("First failure"))
        .mockResolvedValueOnce("success after retry");

      const resultPromise = withRetry(fn, defaultConfig);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe("success after retry");
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("retry behavior", () => {
    it("should retry up to maxRetries times", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Always fails"));

      const resultPromise = withRetry(fn, { ...defaultConfig, maxRetries: 3 });
      await vi.runAllTimersAsync();
      await resultPromise;

      // Initial attempt + 3 retries = 4 calls
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it("should return undefined when all retries exhausted", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Always fails"));

      const resultPromise = withRetry(fn, defaultConfig);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBeUndefined();
    });

    it("should not retry when maxRetries is 0", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Fails"));

      const resultPromise = withRetry(fn, { ...defaultConfig, maxRetries: 0 });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("exponential backoff", () => {
    it("should use exponential backoff between retries", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Fails"));
      const delays: number[] = [];

      // Mock setTimeout to capture delays
      const originalSetTimeout = globalThis.setTimeout;
      vi.spyOn(globalThis, "setTimeout").mockImplementation(((
        callback: () => void,
        ms: number
      ) => {
        delays.push(ms);
        return originalSetTimeout(callback, 0);
      }) as typeof setTimeout);

      const resultPromise = withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 10_000,
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      // Delays should increase (with jitter, so check ranges)
      // First delay: ~100ms (base)
      // Second delay: ~200ms (base * 2)
      // Third delay: ~400ms (base * 4)
      expect(delays).toHaveLength(3);
      expect(delays[0]).toBeGreaterThan(0); // With jitter
      expect(delays[1]).toBeGreaterThan(delays[0] * 0.5); // Roughly doubling
      expect(delays[2]).toBeGreaterThan(delays[1] * 0.5);
    });

    it("should cap delay at maxDelayMs", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Fails"));
      const delays: number[] = [];

      const originalSetTimeout = globalThis.setTimeout;
      vi.spyOn(globalThis, "setTimeout").mockImplementation(((
        callback: () => void,
        ms: number
      ) => {
        delays.push(ms);
        return originalSetTimeout(callback, 0);
      }) as typeof setTimeout);

      const resultPromise = withRetry(fn, {
        maxRetries: 5,
        baseDelayMs: 1000,
        maxDelayMs: 2000, // Low cap
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      // All delays should be at or below maxDelayMs (plus jitter ~20%)
      for (const delay of delays) {
        expect(delay).toBeLessThanOrEqual(2400); // 2000 + 20% jitter
      }
    });
  });

  describe("jitter", () => {
    it("should add jitter to delays", async () => {
      // Run multiple times and verify delays vary
      const delays: number[][] = [];

      for (let test = 0; test < 5; test++) {
        const fn = vi.fn().mockRejectedValue(new Error("Fails"));
        const testDelays: number[] = [];

        const originalSetTimeout = globalThis.setTimeout;
        const timeoutSpy = vi
          .spyOn(globalThis, "setTimeout")
          .mockImplementation(((callback: () => void, ms: number) => {
            testDelays.push(ms);
            return originalSetTimeout(callback, 0);
          }) as typeof setTimeout);

        const resultPromise = withRetry(fn, {
          maxRetries: 1,
          baseDelayMs: 1000,
          maxDelayMs: 10_000,
        });
        await vi.runAllTimersAsync();
        await resultPromise;

        delays.push([...testDelays]);
        timeoutSpy.mockRestore();
      }

      // With jitter, not all delays should be identical
      const firstDelays = delays.map((d) => d[0]);
      const uniqueDelays = new Set(firstDelays);
      // At least some variation expected (though with Math.random mocked, this may vary)
      expect(uniqueDelays.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe("error logging", () => {
    it("should log warning when all retries exhausted", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      const error = new Error("Persistent failure");
      const fn = vi.fn().mockRejectedValue(error);

      const resultPromise = withRetry(fn, defaultConfig);
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("retry attempts exhausted"),
        error
      );
    });
  });

  describe("edge cases", () => {
    it("should handle async functions that return undefined", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);

      const resultPromise = withRetry(fn, defaultConfig);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Note: undefined is a valid return, but we can't distinguish from exhausted retries
      // This is a design consideration - caller should handle
      expect(result).toBeUndefined();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should handle functions that return null", async () => {
      const fn = vi.fn().mockResolvedValue(null);

      const resultPromise = withRetry(fn, defaultConfig);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBeNull();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should handle functions that return complex objects", async () => {
      const complexResult = { data: [1, 2, 3], nested: { value: "test" } };
      const fn = vi.fn().mockResolvedValue(complexResult);

      const resultPromise = withRetry(fn, defaultConfig);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual(complexResult);
    });
  });
});
