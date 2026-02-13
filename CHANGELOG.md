# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-13

### Added

- **Configurable x402 detection** — Payment metadata can now be read from response headers, JSON response body, or both via the new `x402.source` configuration option (`"header"` | `"body"` | `"both"`).
- **Custom field mapping** — Configure custom header/body key names for payment fields via `x402.fieldMapping` to support APIs that use non-standard field names (e.g., `pay-to` instead of `x-payment-address`).
- **Body parsing utilities** — New `parsePaymentBody()` function to extract payment metadata from JSON response bodies.
- **Enhanced detection API** — `detectX402()` now accepts optional `config` and `body` parameters for configurable detection.
- **Response body attachment** — Express adapter supports `res.locals['x402Body']` and Fastify adapter supports `request.x402Body` for passing response body to the SDK.
- **New exports** — Added `X402DetectionConfig`, `PaymentMetadataSource`, `PaymentFieldMapping`, `X402DetectionConfigSchema`, and `applyX402DetectionDefaults` to public API.

### Changed

- **Backward compatible** — All changes are additive with sensible defaults. Existing code continues to work without modifications.
- **Parser functions** — `parsePaymentHeaders()` now accepts an optional `fieldMapping` parameter for custom key names.

## [0.1.0] - 2026-02-12

### Added

- **Core SDK** — `createTollgateSdk()` factory with Zod-validated configuration and sensible defaults.
- **Express adapter** — `createExpressMiddleware()` for drop-in Express integration with fail-open semantics.
- **Fastify adapter** — `fastifyTollgate` plugin for Fastify with `onRequest` / `onResponse` hooks.
- **x402 detection** — Automatic detection of HTTP 402 responses, `X-Payment-*` headers, and L402/LSAT `WWW-Authenticate` headers.
- **Event system** — Versioned analytics event schema (v1.0) with builders for `request.received`, `payment.required`, `payment.verified`, `payment.failed`, and `request.completed` events.
- **Batched transport** — In-memory event queue with configurable batch size, auto-flush interval, and exponential backoff retry with jitter.
- **Privacy controls** — Automatic sensitive header redaction, configurable allowlists, SHA-256 IP hashing with custom salts.
- **Sampling** — Configurable request sampling rate (0-100%).
- **Dual module format** — ESM and CJS builds with full TypeScript declarations.
- **Comprehensive test suite** — Unit tests across all modules with Vitest.
