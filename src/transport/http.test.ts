import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import type { AnalyticsEvent } from "../events/schema.js";
import { EventType } from "../events/types.js";
import { sendBatch } from "./http.js";

describe("sendBatch", () => {
  const mockConfig = {
    batchSize: 10,
    flushIntervalMs: 5000,
    maxRetries: 3,
    timeoutMs: 5000,
  };

  const apiKey = "test-api-key";
  const endpoint = "https://api.example.com/events";

  const createMockEvent = (id: string): AnalyticsEvent => ({
    schemaVersion: "1.0",
    eventId: `550e8400-e29b-41d4-a716-44665544000${id}`,
    eventType: EventType.REQUEST_RECEIVED,
    timestamp: new Date().toISOString(),
    request: {
      id: `550e8400-e29b-41d4-a716-44665544100${id}`,
      method: "GET",
      path: `/api/test/${id}`,
    },
    sdk: {
      name: "tollgate-sdk",
      version: "0.1.0",
    },
  });

  let fetchSpy: MockInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );
    vi.spyOn(console, "warn").mockImplementation(() => {
      // do nothing
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("successful requests", () => {
    it("should return success for empty events array", async () => {
      const result = await sendBatch([], mockConfig, apiKey, endpoint);
      expect(result.success).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should send events to endpoint", async () => {
      const events = [createMockEvent("1"), createMockEvent("2")];
      const resultPromise = sendBatch(events, mockConfig, apiKey, endpoint);
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(fetchSpy).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(events),
        })
      );
    });

    it("should include correct headers", async () => {
      const events = [createMockEvent("1")];
      const resultPromise = sendBatch(events, mockConfig, apiKey, endpoint);
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(fetchSpy).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "User-Agent": expect.stringContaining("tollgate-sdk"),
          }),
        })
      );
    });

    it("should return success with status code on successful response", async () => {
      const events = [createMockEvent("1")];
      const resultPromise = sendBatch(events, mockConfig, apiKey, endpoint);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });
  });

  describe("error handling", () => {
    it("should return failure for non-ok response after retries", async () => {
      fetchSpy.mockResolvedValue(
        new Response("Internal Server Error", {
          status: 500,
          statusText: "Internal Server Error",
        })
      );

      const events = [createMockEvent("1")];
      const resultPromise = sendBatch(
        events,
        { ...mockConfig, maxRetries: 1 },
        apiKey,
        endpoint
      );
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain("retry attempts exhausted");
    });

    it("should return failure on network error after retries", async () => {
      fetchSpy.mockRejectedValue(new Error("Network error"));

      const events = [createMockEvent("1")];
      const resultPromise = sendBatch(
        events,
        { ...mockConfig, maxRetries: 0 },
        apiKey,
        endpoint
      );
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
    });
  });

  describe("retry behavior", () => {
    it("should retry on failure", async () => {
      fetchSpy
        .mockRejectedValueOnce(new Error("First failure"))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true }), { status: 200 })
        );

      const events = [createMockEvent("1")];
      const resultPromise = sendBatch(events, mockConfig, apiKey, endpoint);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it("should respect maxRetries setting", async () => {
      fetchSpy.mockRejectedValue(new Error("Always fails"));

      const events = [createMockEvent("1")];
      const configWithRetries = { ...mockConfig, maxRetries: 2 };

      const resultPromise = sendBatch(
        events,
        configWithRetries,
        apiKey,
        endpoint
      );
      await vi.runAllTimersAsync();
      await resultPromise;

      // Initial attempt + 2 retries = 3 calls
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("should succeed on last retry", async () => {
      fetchSpy
        .mockRejectedValueOnce(new Error("Fail 1"))
        .mockRejectedValueOnce(new Error("Fail 2"))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true }), { status: 200 })
        );

      const events = [createMockEvent("1")];
      const resultPromise = sendBatch(
        events,
        { ...mockConfig, maxRetries: 2 },
        apiKey,
        endpoint
      );
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
    });
  });

  describe("timeout handling", () => {
    it("should use AbortController for timeout", async () => {
      const events = [createMockEvent("1")];
      const resultPromise = sendBatch(events, mockConfig, apiKey, endpoint);
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(fetchSpy).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });
  });

  describe("authorization", () => {
    it("should include Bearer token in Authorization header", async () => {
      const events = [createMockEvent("1")];
      const resultPromise = sendBatch(events, mockConfig, apiKey, endpoint);
      await vi.runAllTimersAsync();
      await resultPromise;

      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer test-api-key");
    });
  });
});
