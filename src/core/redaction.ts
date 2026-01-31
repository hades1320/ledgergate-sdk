/**
 * Set of header names that are considered sensitive and should be redacted
 * All names are lowercase for case-insensitive comparison
 */
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "x-access-token",
  "x-csrf-token",
  "x-xsrf-token",
  "proxy-authorization",
  "www-authenticate",
]);

/**
 * Placeholder value for redacted headers
 */
const REDACTED = "[REDACTED]" as const;

/**
 * Redacts sensitive headers from a headers object
 * @param headers - Original headers object (case-insensitive keys)
 * @param allowlist - Array of header names to allow through without redaction
 * @returns New object with sensitive headers redacted
 */
export function redactHeaders(
  headers: Record<string, string | string[] | undefined>,
  allowlist: readonly string[] = []
): Record<string, string> {
  const allowlistSet = new Set(allowlist.map((h) => h.toLowerCase()));
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    const lowerKey = key.toLowerCase();

    // Skip if header is sensitive and not in allowlist
    if (SENSITIVE_HEADERS.has(lowerKey) && !allowlistSet.has(lowerKey)) {
      result[lowerKey] = REDACTED;
      continue;
    }

    // Flatten array values to comma-separated string
    result[lowerKey] = Array.isArray(value) ? value.join(", ") : value;
  }

  return result;
}

/**
 * Checks if a header name is considered sensitive
 * @param headerName - Header name to check
 * @returns true if the header is sensitive
 */
export function isSensitiveHeader(headerName: string): boolean {
  return SENSITIVE_HEADERS.has(headerName.toLowerCase());
}
