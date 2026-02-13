# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
