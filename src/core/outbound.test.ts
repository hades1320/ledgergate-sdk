import { describe, expect, it } from "vitest";
import { type OutboundCall, trackOutboundCall } from "./outbound.js";

describe("trackOutboundCall", () => {
	it("should track a successful call and record latency & status", async () => {
		const context = { outboundCalls: [] as OutboundCall[] };
		const result = await trackOutboundCall(
			context,
			{ url: "https://facilitator.io/verify", method: "POST" },
			() => {
				return Promise.resolve({ status: 200, data: { success: true } });
			}
		);

		expect(result.data.success).toBe(true);
		expect(context.outboundCalls).toHaveLength(1);
		const call = context.outboundCalls[0];
		expect(call?.url).toBe("https://facilitator.io/verify");
		expect(call?.method).toBe("POST");
		expect(call?.statusCode).toBe(200);
		expect(call?.latencyMs).toBeGreaterThanOrEqual(0);
		expect(call?.error).toBeUndefined();
	});

	it("should track a failed call and capture error status and message", async () => {
		const context = { outboundCalls: [] as OutboundCall[] };

		await expect(
			trackOutboundCall(
				context,
				{ url: "https://facilitator.io/settle", method: "POST" },
				() => {
					const err = new Error("Connection failed") as any;
					err.status = 500;
					return Promise.reject(err);
				}
			)
		).rejects.toThrow("Connection failed");

		expect(context.outboundCalls).toHaveLength(1);
		const call = context.outboundCalls[0];
		expect(call?.url).toBe("https://facilitator.io/settle");
		expect(call?.statusCode).toBe(500);
		expect(call?.error).toBe("Connection failed");
	});
});
