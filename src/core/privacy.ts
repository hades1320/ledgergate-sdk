import { createHash } from "node:crypto";

/**
 * Default salt for IP hashing when none is provided
 * In production, a unique salt should be configured per deployment
 */
const DEFAULT_SALT = "ledgergate-sdk-default-salt";

/**
 * Number of characters to use from the hash output
 */
const HASH_LENGTH = 16;

/**
 * Hashes an IP address using SHA-256 with salt
 * Returns a truncated hash for privacy while maintaining uniqueness
 *
 * @param ip - IP address to hash
 * @param salt - Optional salt for the hash (default: internal salt)
 * @returns Truncated SHA-256 hash of the IP
 */
export function hashIp(ip: string, salt: string = DEFAULT_SALT): string {
  const hash = createHash("sha256");
  hash.update(salt);
  hash.update(ip);
  return hash.digest("hex").slice(0, HASH_LENGTH);
}

/**
 * Extracts the client IP from various sources
 * Checks common proxy headers before falling back to direct IP
 *
 * @param headers - Request headers object
 * @param directIp - Direct connection IP address
 * @returns Best guess at the client's real IP
 */
export function extractClientIp(
  headers: Record<string, string | string[] | undefined>,
  directIp?: string
): string | undefined {
  // Check X-Forwarded-For first (most common proxy header)
  const forwardedFor = headers["x-forwarded-for"];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    // X-Forwarded-For can contain multiple IPs; the first is the client
    const firstIp = ips?.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  // Check X-Real-IP (used by nginx)
  const realIp = headers["x-real-ip"];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Fall back to direct IP
  return directIp;
}
