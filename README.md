# tollgate-sdk

> Lightweight, non-custodial observability for x402-monetized HTTP APIs.

[![npm version](https://img.shields.io/npm/v/tollgate-sdk)](https://www.npmjs.com/package/tollgate-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)

---

## What is tollgate-sdk?

**tollgate-sdk** is a passive observability SDK that sits in your HTTP middleware layer and automatically detects, tracks, and reports [x402 Payment Required](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/402) interactions — without ever touching funds or private keys.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           SDK Middleware Layer                               │
├──────────────────────────────────────────────────────────────────────────────┤
│  Request In ──► Context Creation ──► User Handler ──► Response Hook          │
│                     │                                      │                 │
│                     └──────────► Event Builder ◄───────────┘                 │
│                                        │                                     │
│                                   EventQueue                                 │
│                                        │                                     │
│                              Transport (Batched HTTP)                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Key Invariants

- **Fail-open** — All SDK operations are wrapped in `try-catch`. Errors are logged (in debug mode) but never thrown to your application code.
- **Non-blocking** — Event emission is fire-and-forget via an async batched queue.
- **Privacy-by-default** — No request/response bodies are captured. Sensitive headers are redacted. IP addresses are hashed.

---

## Installation

```bash
npm install tollgate-sdk
```

> **Peer dependencies**: `express` and `fastify` are optional. Install whichever framework you use.

---

## Quick Start

### Express

```typescript
import express from "express";
import { createTollgateSdk, createExpressMiddleware } from "tollgate-sdk";

const sdk = createTollgateSdk({
  apiKey: process.env.TOLLGATE_API_KEY!,
  debug: process.env.NODE_ENV !== "production",
});

const app = express();
app.use(createExpressMiddleware(sdk));

app.get("/", (_req, res) => {
  res.json({ message: "Hello, x402!" });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await sdk.shutdown();
  process.exit(0);
});
```

### Fastify

```typescript
import Fastify from "fastify";
import { createTollgateSdk, fastifyTollgate } from "tollgate-sdk";

const sdk = createTollgateSdk({
  apiKey: process.env.TOLLGATE_API_KEY!,
  debug: process.env.NODE_ENV !== "production",
});

const app = Fastify();
await app.register(fastifyTollgate, { sdk });

app.get("/", async () => {
  return { message: "Hello, x402!" };
});

await app.listen({ port: 3000 });

// Graceful shutdown
process.on("SIGTERM", async () => {
  await sdk.shutdown();
  await app.close();
  process.exit(0);
});
```

---

## Configuration

Pass a configuration object to `createTollgateSdk()`. Only `apiKey` is required — everything else has sensible defaults.

```typescript
const sdk = createTollgateSdk({
  // Required
  apiKey: "your-api-key",

  // Optional — all fields below have defaults
  endpoint: "https://api.tollgate.io/v1/events",
  sampleRate: 1, // 0-1, where 1 = 100%
  debug: false,

  redaction: {
    hashIp: true, // Hash client IPs with SHA-256
    allowedHeaders: [], // Headers to pass through without redaction
    ipHashSalt: undefined, // Custom salt for IP hashing
  },

  transport: {
    batchSize: 10, // Events per batch (1-100)
    flushIntervalMs: 5000, // Auto-flush interval (100-30000 ms)
    maxRetries: 3, // Retry attempts (0-5)
    timeoutMs: 10000, // HTTP timeout (1000-30000 ms)
  },
});
```

### Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | **Required.** API key for the analytics endpoint. |
| `endpoint` | `string` | `https://api.tollgate.io/v1/events` | Analytics endpoint URL. |
| `sampleRate` | `number` | `1` | Sampling rate between `0` (0%) and `1` (100%). |
| `debug` | `boolean` | `false` | Enables console logging for SDK errors. |
| `redaction.hashIp` | `boolean` | `true` | Hash client IP addresses using SHA-256. |
| `redaction.allowedHeaders` | `string[]` | `[]` | Header names to allow through without redaction. |
| `redaction.ipHashSalt` | `string` | Internal default | Custom salt for IP hashing. |
| `transport.batchSize` | `number` | `10` | Number of events to batch before sending. |
| `transport.flushIntervalMs` | `number` | `5000` | Auto-flush interval in milliseconds. |
| `transport.maxRetries` | `number` | `3` | Maximum retry attempts for failed requests. |
| `transport.timeoutMs` | `number` | `10000` | HTTP request timeout in milliseconds. |

---

## Privacy & Redaction

The SDK is **privacy-by-default**. The following protections are always active:

### Sensitive Header Redaction

These headers are automatically replaced with `[REDACTED]`:

- `authorization`
- `cookie` / `set-cookie`
- `x-api-key`
- `x-auth-token` / `x-access-token`
- `x-csrf-token` / `x-xsrf-token`
- `proxy-authorization`
- `www-authenticate`

Use `redaction.allowedHeaders` to selectively permit specific headers through.

### IP Address Hashing

Client IPs are hashed using SHA-256 with a configurable salt, then truncated to 16 characters. This allows correlation without storing raw addresses.

```typescript
const sdk = createTollgateSdk({
  apiKey: "your-api-key",
  redaction: {
    hashIp: true, // default
    ipHashSalt: "my-unique-deployment-salt",
  },
});
```

Set `redaction.hashIp` to `false` to disable IP hashing entirely (IPs will not be collected).

---

## Event Types

The SDK automatically emits the following event types:

| Event | Trigger | Description |
|-------|---------|-------------|
| `request.received` | Incoming request | Fired when a new HTTP request enters the middleware. |
| `payment.required` | HTTP 402 response | Fired when the server responds with Payment Required. |
| `payment.verified` | Payment verified | Fired when x402 payment verification succeeds. |
| `payment.failed` | Payment failed | Fired when x402 payment verification fails. |
| `request.completed` | Response sent | Fired when the response is fully sent to the client. |

### Event Schema (v1.0)

Every event follows this structure:

```typescript
interface AnalyticsEvent {
  schemaVersion: "1.0";
  eventId: string; // UUID v4
  eventType: string; // One of the event types above
  timestamp: string; // ISO 8601

  request: {
    id: string; // Request correlation ID (UUID v4)
    method: string; // HTTP method (uppercase)
    path: string; // Normalized request path
    statusCode?: number; // HTTP response status
    latencyMs?: number; // Response latency in ms
    clientIpHash?: string; // Hashed client IP
    headers?: Record<string, string>; // Redacted headers
  };

  payment?: {
    isRequired: boolean;
    address?: string; // Payment destination address
    amount?: string; // Payment amount
    network?: string; // Payment network (bitcoin, lightning, etc.)
    token?: string; // Currency/token symbol (BTC, SATS, etc.)
    status?: "required" | "verified" | "failed";
  };

  sdk: {
    name: "tollgate-sdk";
    version: string;
  };
}
```

---

## x402 Detection

The SDK automatically detects x402 payment signals from HTTP responses by:

1. Checking for **HTTP 402** status codes
2. Parsing **`X-Payment-*`** headers (`X-Payment-Address`, `X-Payment-Amount`, `X-Payment-Network`, `X-Payment-Token`, `X-Payment-Status`)
3. Parsing **`WWW-Authenticate: L402`** headers (Lightning/LSAT protocol)

You can also use the detection utilities directly:

```typescript
import { detectX402, isPaymentRequired, parsePaymentHeaders } from "tollgate-sdk";

// Check if a response is x402
const metadata = detectX402(statusCode, responseHeaders);

// Simple 402 check
const is402 = isPaymentRequired(statusCode);

// Parse payment headers manually
const paymentInfo = parsePaymentHeaders(responseHeaders);
```

---

## Advanced Usage

### Accessing Request Context

In **Express**, the request context is attached to `res.locals`:

```typescript
app.get("/api/resource", (req, res) => {
  const context = res.locals["x402Context"];
  // context.id — Request correlation ID
  // context.method — HTTP method
  // context.path — Normalized path 
  res.json({ requestId: context?.id });
});
```

In **Fastify**, it's available on `request.x402Context`:

```typescript
app.get("/api/resource", async (request) => {
  const context = request.x402Context;
  return { requestId: context?.id };
});
```

### Custom Sampling

Control what percentage of requests are tracked:

```typescript
const sdk = createTollgateSdk({
  apiKey: "your-api-key",
  sampleRate: 0.1, // Track only 10% of requests
});
```

### Graceful Shutdown

Always call `sdk.shutdown()` before your process exits to flush any remaining events in the queue:

```typescript
process.on("SIGTERM", async () => {
  await sdk.shutdown();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await sdk.shutdown();
  process.exit(0);
});
```

---

## API Reference

### Core

| Export | Type | Description |
|--------|------|-------------|
| `createTollgateSdk(config)` | Function | Creates and returns an `SdkInstance`. |
| `SdkConfigSchema` | Zod Schema | Validation schema for SDK configuration. |
| `parseConfig(input)` | Function | Validates and applies defaults to config (throws on error). |
| `safeParseConfig(input)` | Function | Validates config without throwing (returns result object). |

### Adapters

| Export | Type | Description |
|--------|------|-------------|
| `createExpressMiddleware(sdk)` | Function | Creates Express middleware from an `SdkInstance`. |
| `fastifyTollgate` | Fastify Plugin | Fastify plugin — register with `app.register(fastifyTollgate, { sdk })`. |

### Events

| Export | Type | Description |
|--------|------|-------------|
| `EventType` | Const Map | Map of event type constants (`REQUEST_RECEIVED`, etc.). |
| `AnalyticsEventSchema` | Zod Schema | Validation schema for analytics events. |
| `buildRequestReceivedEvent(ctx)` | Function | Builds a `request.received` event. |
| `buildPaymentRequiredEvent(ctx, payment, response)` | Function | Builds a `payment.required` event. |
| `buildPaymentVerifiedEvent(ctx, payment, response)` | Function | Builds a `payment.verified` event. |
| `buildPaymentFailedEvent(ctx, payment, response)` | Function | Builds a `payment.failed` event. |
| `buildRequestCompletedEvent(ctx, response, payment?)` | Function | Builds a `request.completed` event. |

### x402 Utilities

| Export | Type | Description |
|--------|------|-------------|
| `detectX402(statusCode, headers)` | Function | Detects x402 signals and returns `X402Metadata` or `undefined`. |
| `isPaymentRequired(statusCode)` | Function | Returns `true` if status code is 402. |
| `parsePaymentHeaders(headers)` | Function | Parses `X-Payment-*` and L402 headers. |

### Privacy

| Export | Type | Description |
|--------|------|-------------|
| `hashIp(ip, salt?)` | Function | Hashes an IP address using SHA-256. |
| `extractClientIp(headers, directIp?)` | Function | Extracts client IP from proxy headers. |
| `redactHeaders(headers, allowlist?)` | Function | Redacts sensitive headers. |
| `isSensitiveHeader(name)` | Function | Checks if a header name is sensitive. |

### Types

| Export | Kind | Description |
|--------|------|-------------|
| `SdkConfig` | Interface | Resolved SDK configuration (after defaults). |
| `SdkConfigInput` | Type | Raw SDK configuration input (before defaults). |
| `SdkInstance` | Interface | SDK instance returned by `createTollgateSdk`. |
| `AnalyticsEvent` | Type | Validated analytics event shape. |
| `X402Metadata` | Interface | x402 payment metadata. |
| `RequestContext` | Interface | Immutable per-request context. |
| `ResponseData` | Interface | Mutable response data (status, latency). |
| `Timer` | Interface | High-resolution timer. |
| `RedactionConfig` | Interface | Resolved redaction configuration. |
| `TransportConfig` | Interface | Resolved transport configuration. |
| `PaymentStatus` | Type | Payment status union (`"required" | "verified" | "failed"`). |
| `FastifyTollgateOptions` | Interface | Options for the Fastify plugin. |

---

## Requirements

- **Node.js** ≥ 18.0.0 (uses native `fetch` and `crypto`)
- **TypeScript** 5.x (optional, but recommended)
- **Express** 4.x or 5.x, or **Fastify** 4.x or 5.x

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type check
npm run typecheck

# Lint & format
npm run check    # Check for issues
npm run fix      # Auto-fix issues
```

---

## License

[MIT](LICENSE)
