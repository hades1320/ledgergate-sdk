import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  captureResponseData,
  createRequestContext,
  type RequestContext,
  type ResponseData,
} from "../core/context.js";
import { shouldSample } from "../core/sampling.js";
import {
  buildPaymentFailedEvent,
  buildPaymentRequiredEvent,
  buildPaymentVerifiedEvent,
  buildRequestCompletedEvent,
  buildRequestReceivedEvent,
} from "../events/builders.js";
import { detectX402 } from "../x402/detector.js";
import type { X402Metadata } from "../x402/types.js";
import type { SdkInstance } from "./types.js";

/**
 * Handles x402-specific event emission logic
 */
function handleX402Event(
  context: RequestContext,
  x402Metadata: X402Metadata,
  responseData: ResponseData,
  sdk: SdkInstance
) {
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
    const event = buildPaymentFailedEvent(context, x402Metadata, responseData);
    sdk.queue.enqueue(event);
  } else {
    // Default to completed if no specific status but x402 metadata present (e.g. informative)
    const event = buildRequestCompletedEvent(
      context,
      responseData,
      x402Metadata
    );
    sdk.queue.enqueue(event);
  }
}

/**
 * Handles logic when the response finishes
 */
function handleResponseFinish(
  res: Response,
  context: RequestContext,
  sdk: SdkInstance,
  sampled: boolean
) {
  try {
    if (!sampled) {
      return;
    }

    // Capture response data (status, latency)
    const responseData = captureResponseData(context, res.statusCode);

    // Detect x402 metadata
    // getHeaders() returns a plain object in recent Node/Express versions
    const headers = res.getHeaders() as Record<
      string,
      string | string[] | undefined
    >;
    const x402Metadata = detectX402(res.statusCode, headers);

    // Determine which event to emit based on x402 state
    if (x402Metadata) {
      handleX402Event(context, x402Metadata, responseData, sdk);
    } else {
      // Standard request completion
      const event = buildRequestCompletedEvent(context, responseData);
      sdk.queue.enqueue(event);
    }
  } catch (error) {
    if (sdk.config.debug) {
      console.error("[tollgate-sdk] Error in response finish handler:", error);
    }
  }
}

/**
 * Creates an Express middleware for x402 observability.
 *
 * The middleware automatically:
 * 1. Creates a request context with a unique ID, timer, and redacted headers
 * 2. Emits a `request.received` event (if sampled)
 * 3. Hooks into the response `finish` event to emit completion/payment events
 *
 * All SDK logic is wrapped in `try-catch` to ensure fail-open behavior —
 * the middleware will never throw or break your application.
 *
 * @param sdk - The initialized SDK instance from `createTollgateSdk()`
 * @returns Express `RequestHandler` middleware
 *
 * @example
 * ```typescript
 * import express from "express";
 * import { createTollgateSdk, createExpressMiddleware } from "tollgate-sdk";
 *
 * const sdk = createTollgateSdk({ apiKey: "your-api-key" });
 * const app = express();
 *
 * app.use(createExpressMiddleware(sdk));
 * ```
 */
export function createExpressMiddleware(sdk: SdkInstance): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    // Fail-open: Wrap everything in try-catch to prevent SDK errors from breaking the app
    try {
      // 1. Sampling check
      const sampled = shouldSample(sdk.config.sampleRate);

      // 2. Create request context
      const context = createRequestContext({
        method: req.method,
        path: req.path, // Express provides parsed path without query
        headers: req.headers,
        ...(req.ip ? { remoteAddress: req.ip } : {}),
        redaction: sdk.config.redaction,
        sampled,
      });

      // Attach context to locals for downstream access if needed
      // biome-ignore lint/complexity/useLiteralKeys: TS requires bracket notation for index signatures
      res.locals["x402Context"] = context;

      // 3. Emit request received event (if sampled)
      if (sampled) {
        const event = buildRequestReceivedEvent(context);
        sdk.queue.enqueue(event);
      }

      // 4. Hook into response completion
      // We use 'finish' event which fires when the response has been sent
      res.on("finish", () => {
        handleResponseFinish(res, context, sdk, sampled);
      });
    } catch (error) {
      if (sdk.config.debug) {
        console.error("[tollgate-sdk] Error in middleware:", error);
      }
    }

    // Always proceed
    next();
  };
}
