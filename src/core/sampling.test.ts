import { describe, expect, it } from "vitest";
import { shouldSample } from "./sampling.js";

describe("shouldSample", () => {
  describe("edge cases", () => {
    it("should always return false for rate 0", () => {
      for (let i = 0; i < 100; i++) {
        expect(shouldSample(0)).toBe(false);
      }
    });

    it("should always return false for negative rate", () => {
      expect(shouldSample(-0.5)).toBe(false);
      expect(shouldSample(-1)).toBe(false);
    });

    it("should always return true for rate 1", () => {
      for (let i = 0; i < 100; i++) {
        expect(shouldSample(1)).toBe(true);
      }
    });

    it("should always return true for rate greater than 1", () => {
      expect(shouldSample(1.5)).toBe(true);
      expect(shouldSample(2)).toBe(true);
    });
  });

  describe("sampling distribution", () => {
    it("should sample approximately 50% at rate 0.5", () => {
      const iterations = 10_000;
      let sampledCount = 0;

      for (let i = 0; i < iterations; i++) {
        if (shouldSample(0.5)) {
          sampledCount++;
        }
      }

      const sampledRate = sampledCount / iterations;
      // Allow ±10% variance for random sampling
      expect(sampledRate).toBeGreaterThan(0.4);
      expect(sampledRate).toBeLessThan(0.6);
    });

    it("should sample approximately 10% at rate 0.1", () => {
      const iterations = 10_000;
      let sampledCount = 0;

      for (let i = 0; i < iterations; i++) {
        if (shouldSample(0.1)) {
          sampledCount++;
        }
      }

      const sampledRate = sampledCount / iterations;
      // Allow ±5% variance for random sampling
      expect(sampledRate).toBeGreaterThan(0.05);
      expect(sampledRate).toBeLessThan(0.15);
    });

    it("should sample approximately 90% at rate 0.9", () => {
      const iterations = 10_000;
      let sampledCount = 0;

      for (let i = 0; i < iterations; i++) {
        if (shouldSample(0.9)) {
          sampledCount++;
        }
      }

      const sampledRate = sampledCount / iterations;
      // Allow ±5% variance for random sampling
      expect(sampledRate).toBeGreaterThan(0.85);
      expect(sampledRate).toBeLessThan(0.95);
    });
  });

  describe("return type", () => {
    it("should always return a boolean", () => {
      expect(typeof shouldSample(0)).toBe("boolean");
      expect(typeof shouldSample(0.5)).toBe("boolean");
      expect(typeof shouldSample(1)).toBe("boolean");
    });
  });
});
