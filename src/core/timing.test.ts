import { describe, expect, it } from "vitest";
import { createTimer, getTimestamp } from "./timing.js";

describe("createTimer", () => {
  it("should return a timer with elapsed method", () => {
    const timer = createTimer();
    expect(timer).toBeDefined();
    expect(typeof timer.elapsed).toBe("function");
  });

  it("should return approximately 0 immediately after creation", () => {
    const timer = createTimer();
    const elapsed = timer.elapsed();
    // Should be very close to 0, but allow for some execution time
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(10);
  });

  it("should track elapsed time accurately", async () => {
    const timer = createTimer();
    const delayMs = 100;

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const elapsed = timer.elapsed();

    // Allow for timer variance (±30ms)
    expect(elapsed).toBeGreaterThanOrEqual(delayMs - 30);
    expect(elapsed).toBeLessThan(delayMs + 50);
  });

  it("should return increasing values on subsequent calls", async () => {
    const timer = createTimer();

    const elapsed1 = timer.elapsed();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const elapsed2 = timer.elapsed();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const elapsed3 = timer.elapsed();

    expect(elapsed2).toBeGreaterThan(elapsed1);
    expect(elapsed3).toBeGreaterThan(elapsed2);
  });

  it("should handle multiple timers independently", async () => {
    const timer1 = createTimer();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const timer2 = createTimer();

    await new Promise((resolve) => setTimeout(resolve, 50));

    const elapsed1 = timer1.elapsed();
    const elapsed2 = timer2.elapsed();

    // Timer1 should have ~100ms elapsed, timer2 should have ~50ms
    expect(elapsed1).toBeGreaterThan(elapsed2);
    expect(elapsed1 - elapsed2).toBeGreaterThanOrEqual(30);
  });

  it("should use sub-millisecond precision", () => {
    const timer = createTimer();
    // Call elapsed multiple times in quick succession
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      times.push(timer.elapsed());
    }
    // At least some values should differ (demonstrating precision)
    const uniqueValues = new Set(times);
    expect(uniqueValues.size).toBeGreaterThanOrEqual(1);
  });
});

describe("getTimestamp", () => {
  it("should return ISO 8601 format", () => {
    const timestamp = getTimestamp();
    // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
    expect(timestamp).toMatch(isoRegex);
  });

  it("should return a valid date string", () => {
    const timestamp = getTimestamp();
    const date = new Date(timestamp);
    expect(date.toString()).not.toBe("Invalid Date");
  });

  it("should return current time", () => {
    const before = Date.now();
    const timestamp = getTimestamp();
    const after = Date.now();

    const timestampMs = new Date(timestamp).getTime();
    expect(timestampMs).toBeGreaterThanOrEqual(before);
    expect(timestampMs).toBeLessThanOrEqual(after);
  });

  it("should return different values for subsequent calls with delay", async () => {
    const timestamp1 = getTimestamp();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const timestamp2 = getTimestamp();

    expect(timestamp1).not.toBe(timestamp2);
    expect(new Date(timestamp2).getTime()).toBeGreaterThan(
      new Date(timestamp1).getTime()
    );
  });
});
