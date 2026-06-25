import { createTimer } from "./timing.js";

export interface OutboundCall {
	url: string;
	method: string;
	statusCode?: number | undefined;
	latencyMs: number;
	error?: string | undefined;
}

interface StatusObject {
	status?: unknown;
	statusCode?: unknown;
	response?: unknown;
}

function getStatusCode(result: unknown): number | undefined {
	if (!result || typeof result !== "object") {
		return undefined;
	}
	const obj = result as StatusObject;
	const status = obj.status ?? obj.statusCode;
	return typeof status === "number" ? status : undefined;
}

function getErrorStatusCode(error: unknown): number | undefined {
	if (!error || typeof error !== "object") {
		return undefined;
	}
	const obj = error as StatusObject;
	if (typeof obj.status === "number") {
		return obj.status;
	}
	const response = obj.response;
	if (response && typeof response === "object") {
		const resObj = response as StatusObject;
		if (typeof resObj.status === "number") {
			return resObj.status;
		}
	}
	return undefined;
}

/**
 * Tracks an outbound HTTP call made during a request lifecycle.
 *
 * @param context - The parent RequestContext (which will store the outbound call metrics)
 * @param options - Outbound call options (URL and method)
 * @param callback - Async function that performs the actual outbound call
 * @returns The result of the callback
 */
export async function trackOutboundCall<T>(
	context: { outboundCalls: OutboundCall[] },
	options: { url: string; method: string },
	callback: () => Promise<T>
): Promise<T> {
	const timer = createTimer();
	const outboundCall: Partial<OutboundCall> = {
		url: options.url,
		method: options.method.toUpperCase(),
	};

	try {
		const result = await callback();
		outboundCall.statusCode = getStatusCode(result);
		outboundCall.latencyMs = timer.elapsed();
		context.outboundCalls.push(outboundCall as OutboundCall);
		return result;
	} catch (error) {
		outboundCall.statusCode = getErrorStatusCode(error);
		outboundCall.latencyMs = timer.elapsed();
		outboundCall.error = error instanceof Error ? error.message : String(error);
		context.outboundCalls.push(outboundCall as OutboundCall);
		throw error;
	}
}
