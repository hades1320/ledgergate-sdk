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
import { createEventQueue } from "./queue.js";

describe("createEventQueue", () => {
  const mockConfig = {
    transport: {
      batchSize: 5,
      flushIntervalMs: 1000,
      maxRetries: 3,
      timeoutMs: 5000,
    },
    apiKey: "test-api-key",
    endpoint: "https://api.example.com/events",
    debug: false,
  };

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
    vi.spyOn(console, "error").mockImplementation(() => {
      // do nothing
    });
    vi.spyOn(console, "log").mockImplementation(() => {
      // do nothing
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("enqueue", () => {
    it("should add events to the queue", () => {
      const queue = createEventQueue(mockConfig);
      const event = createMockEvent("1");

      queue.enqueue(event);
      expect(queue.size()).toBe(1);
    });

    it("should accumulate multiple events", () => {
      const queue = createEventQueue(mockConfig);

      queue.enqueue(createMockEvent("1"));
      queue.enqueue(createMockEvent("2"));
      queue.enqueue(createMockEvent("3"));

      expect(queue.size()).toBe(3);
    });
  });

  describe("batch size threshold", () => {
    it("should flush when batch size is reached", async () => {
      const queue = createEventQueue(mockConfig);

      // Enqueue batchSize events
      for (let i = 0; i < 5; i++) {
        queue.enqueue(createMockEvent(String(i)));
      }

      // Allow the async flush to complete
      await vi.runAllTimersAsync();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(queue.size()).toBe(0);
    });

    it("should send correct number of events in batch", async () => {
      const queue = createEventQueue(mockConfig);

      for (let i = 0; i < 5; i++) {
        queue.enqueue(createMockEvent(String(i)));
      }

      await vi.runAllTimersAsync();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as unknown[];
      expect(body).toHaveLength(5);
    });
  });

  describe("interval-based flushing", () => {
    it("should flush on interval when below batch size", async () => {
      const queue = createEventQueue(mockConfig);

      queue.enqueue(createMockEvent("1"));
      queue.enqueue(createMockEvent("2"));

      expect(queue.size()).toBe(2);
      expect(fetchSpy).not.toHaveBeenCalled();

      // Advance time past flush interval
      await vi.advanceTimersByTimeAsync(1100);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(queue.size()).toBe(0);
    });

    it("should not flush immediately if batch size not reached", () => {
      const queue = createEventQueue(mockConfig);

      queue.enqueue(createMockEvent("1"));
      queue.enqueue(createMockEvent("2"));

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("flush", () => {
    it("should manually flush all pending events", async () => {
      const queue = createEventQueue(mockConfig);

      queue.enqueue(createMockEvent("1"));
      queue.enqueue(createMockEvent("2"));

      const flushPromise = queue.flush();
      await vi.runAllTimersAsync();
      await flushPromise;

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(queue.size()).toBe(0);
    });

    it("should handle flush with empty queue", async () => {
      const queue = createEventQueue(mockConfig);

      const flushPromise = queue.flush();
      await vi.runAllTimersAsync();
      await flushPromise;

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should wait for pending flush before manual flush", async () => {
      const queue = createEventQueue(mockConfig);

      // Enqueue enough to trigger auto-flush
      for (let i = 0; i < 5; i++) {
        queue.enqueue(createMockEvent(String(i)));
      }

      // Immediately call flush
      const flushPromise = queue.flush();
      await vi.runAllTimersAsync();
      await flushPromise;

      // Should only have flushed once
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("shutdown", () => {
    it("should flush remaining events on shutdown", async () => {
      const queue = createEventQueue(mockConfig);

      queue.enqueue(createMockEvent("1"));
      queue.enqueue(createMockEvent("2"));

      const shutdownPromise = queue.shutdown();
      await vi.runAllTimersAsync();
      await shutdownPromise;

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(queue.size()).toBe(0);
    });

    it("should not accept new events after shutdown", async () => {
      const queue = createEventQueue({ ...mockConfig, debug: true });

      const shutdownPromise = queue.shutdown();
      await vi.runAllTimersAsync();
      await shutdownPromise;

      queue.enqueue(createMockEvent("1"));

      expect(queue.size()).toBe(0);
    });

    it("should handle multiple shutdown calls", async () => {
      const queue = createEventQueue(mockConfig);

      queue.enqueue(createMockEvent("1"));

      const shutdownPromise1 = queue.shutdown();
      await vi.runAllTimersAsync();
      await shutdownPromise1;

      const shutdownPromise2 = queue.shutdown();
      await vi.runAllTimersAsync();
      await shutdownPromise2;

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("should clear pending timer on shutdown", async () => {
      const queue = createEventQueue(mockConfig);

      queue.enqueue(createMockEvent("1"));
      // Timer is now scheduled

      const shutdownPromise = queue.shutdown();
      await vi.runAllTimersAsync();
      await shutdownPromise;

      // Advance past where timer would fire
      await vi.advanceTimersByTimeAsync(2000);

      // Should only have flushed once during shutdown
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling (fail-open)", () => {
    it("should not throw on fetch failure", async () => {
      fetchSpy.mockRejectedValue(new Error("Network error"));

      const queue = createEventQueue({ ...mockConfig });
      queue.enqueue(createMockEvent("1"));

      const flushPromise = queue.flush();
      await vi.runAllTimersAsync();

      await expect(flushPromise).resolves.not.toThrow();
    });

    it("should log warning in debug mode on failure", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      fetchSpy.mockRejectedValue(new Error("Network error"));

      const queue = createEventQueue({ ...mockConfig, debug: true });
      queue.enqueue(createMockEvent("1"));

      const flushPromise = queue.flush();
      await vi.runAllTimersAsync();
      await flushPromise;

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe("debug logging", () => {
    it("should log enqueue in debug mode", () => {
      const consoleSpy = vi.spyOn(console, "log");

      const queue = createEventQueue({ ...mockConfig, debug: true });
      queue.enqueue(createMockEvent("1"));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Event enqueued")
      );
    });

    it("should log flush in debug mode", async () => {
      const consoleSpy = vi.spyOn(console, "log");

      const queue = createEventQueue({ ...mockConfig, debug: true });
      queue.enqueue(createMockEvent("1"));

      const flushPromise = queue.flush();
      await vi.runAllTimersAsync();
      await flushPromise;

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Flushing")
      );
    });

    it("should log shutdown in debug mode", async () => {
      const consoleSpy = vi.spyOn(console, "log");

      const queue = createEventQueue({ ...mockConfig, debug: true });
      const shutdownPromise = queue.shutdown();
      await vi.runAllTimersAsync();
      await shutdownPromise;

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Shutting down")
      );
    });
  });

  describe("size", () => {
    it("should return current queue size", () => {
      const queue = createEventQueue(mockConfig);

      expect(queue.size()).toBe(0);

      queue.enqueue(createMockEvent("1"));
      expect(queue.size()).toBe(1);

      queue.enqueue(createMockEvent("2"));
      expect(queue.size()).toBe(2);
    });

    it("should return 0 after flush", async () => {
      const queue = createEventQueue(mockConfig);

      queue.enqueue(createMockEvent("1"));
      queue.enqueue(createMockEvent("2"));

      const flushPromise = queue.flush();
      await vi.runAllTimersAsync();
      await flushPromise;

      expect(queue.size()).toBe(0);
    });
  });
});
