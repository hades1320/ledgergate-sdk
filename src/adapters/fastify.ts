/** biome-ignore-all lint/suspicious/useAwait: false */
import type { FastifyPluginAsync } from "fastify";
import type { RequestContext } from "../core/context.js";
import { captureResponseData, createRequestContext } from "../core/context.js";
import { shouldSample } from "../core/sampling.js";
import {
  buildPaymentFailedEvent,
  buildPaymentRequiredEvent,
  buildPaymentVerifiedEvent,
  buildRequestCompletedEvent,
  buildRequestReceivedEvent,
} from "../events/builders.js";
import { detectX402 } from "../x402/detector.js";
import type { SdkInstance } from "./types.js";

// Extend FastifyRequest to include x402Context
declare module "fastify" {
  interface FastifyRequest {
    x402Context?: RequestContext;
  }
}

export interface FastifyTollgateOptions {
  sdk: SdkInstance;
}

/**
 * Fastify plugin for x402 observability
 *
 * @param fastify - Fastify instance
 * @param options - Plugin options containing the SDK instance
 */
export const fastifyTollgate: FastifyPluginAsync<
  FastifyTollgateOptions
> = async (fastify, options) => {
  const { sdk } = options;

  // Decorate request with x402Context (initialized to undefined)
  fastify.decorateRequest("x402Context", undefined);

  // Hook: onRequest
  fastify.addHook("onRequest", async (request, _reply) => {
    try {
      // 1. Sampling check
      const sampled = shouldSample(sdk.config.sampleRate);

      // 2. Create request context
      const context = createRequestContext({
        method: request.method,
        path: request.url, // Fastify url includes path
        headers: request.headers as Record<
          string,
          string | string[] | undefined
        >,
        remoteAddress: request.ip,
        redaction: sdk.config.redaction,
        sampled,
      });

      // Attach context to request
      request.x402Context = context;

      // 3. Emit request received event (if sampled)
      if (sampled) {
        const event = buildRequestReceivedEvent(context);
        sdk.queue.enqueue(event);
      }
    } catch (error) {
      if (sdk.config.debug) {
        console.error("[tollgate-sdk] Error in onRequest hook:", error);
      }
    }
  });

  // Hook: onResponse
  fastify.addHook("onResponse", async (request, reply) => {
    try {
      const context = request.x402Context;
      // If no context (e.g. error in onRequest) or not sampled, skip
      if (!context?.sampled) {
        return;
      }

      // Capture response data
      const responseData = captureResponseData(context, reply.statusCode);

      // Detect x402 metadata
      const headers = reply.getHeaders() as Record<
        string,
        string | string[] | undefined
      >;
      const x402Metadata = detectX402(reply.statusCode, headers);

      // Determine event
      if (x402Metadata) {
        if (x402Metadata.isPaymentRequired) {
          const event = buildPaymentRequiredEvent(
            context,
            x402Metadata,
            responseData
          );
          sdk.queue.enqueue(event);
        } else if (x402Metadata.paymentStatus === "verified") {
          const event = buildPaymentVerifiedEvent(
            context,
            x402Metadata,
            responseData
          );
          sdk.queue.enqueue(event);
        } else if (x402Metadata.paymentStatus === "failed") {
          const event = buildPaymentFailedEvent(
            context,
            x402Metadata,
            responseData
          );
          sdk.queue.enqueue(event);
        } else {
          // Generic completion with metadata
          const event = buildRequestCompletedEvent(
            context,
            responseData,
            x402Metadata
          );
          sdk.queue.enqueue(event);
        }
      } else {
        // Standard completion
        const event = buildRequestCompletedEvent(context, responseData);
        sdk.queue.enqueue(event);
      }
    } catch (error) {
      if (sdk.config.debug) {
        console.error("[tollgate-sdk] Error in onResponse hook:", error);
      }
    }
  });
};
