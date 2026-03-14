import { describe, expect, it } from "vitest";
import { isExcludedPath } from "./paths.js";

describe("isExcludedPath", () => {
  describe("with empty excludePaths", () => {
    it("should return false for any path when excludePaths is empty", () => {
      expect(isExcludedPath("/favicon.ico", [])).toBe(false);
      expect(isExcludedPath("/api/data", [])).toBe(false);
      expect(isExcludedPath("/", [])).toBe(false);
    });
  });

  describe("exact matching", () => {
    it("should match an exact path", () => {
      expect(isExcludedPath("/favicon.ico", ["/favicon.ico"])).toBe(true);
    });

    it("should not match a different path", () => {
      expect(isExcludedPath("/api/data", ["/favicon.ico"])).toBe(false);
    });

    it("should be case-sensitive", () => {
      expect(isExcludedPath("/Favicon.ico", ["/favicon.ico"])).toBe(false);
    });

    it("should match multiple patterns", () => {
      const excludePaths = ["/favicon.ico", "/robots.txt", "/health"];
      expect(isExcludedPath("/robots.txt", excludePaths)).toBe(true);
      expect(isExcludedPath("/health", excludePaths)).toBe(true);
      expect(isExcludedPath("/api/data", excludePaths)).toBe(false);
    });
  });

  describe("wildcard matching", () => {
    it("should match paths with a wildcard suffix", () => {
      expect(isExcludedPath("/static/logo.png", ["/static/*"])).toBe(true);
    });

    it("should match nested paths with a wildcard", () => {
      expect(isExcludedPath("/health/live", ["/health/*"])).toBe(true);
      expect(isExcludedPath("/health/ready", ["/health/*"])).toBe(true);
    });

    it("should not match paths outside the wildcard scope", () => {
      expect(isExcludedPath("/api/data", ["/static/*"])).toBe(false);
    });

    it("should match with wildcard at start", () => {
      expect(isExcludedPath("/anything/favicon.ico", ["*/favicon.ico"])).toBe(
        true
      );
    });

    it("should handle multiple wildcards", () => {
      expect(isExcludedPath("/api/v1/health", ["/api/*/health"])).toBe(true);
    });

    it("should not partially match without wildcard", () => {
      expect(isExcludedPath("/static/logo.png", ["/static"])).toBe(false);
    });
  });

  describe("special character handling", () => {
    it("should treat dots in patterns as literal dots", () => {
      expect(isExcludedPath("/favicon.ico", ["/favicon.ico"])).toBe(true);
      expect(isExcludedPath("/faviconXico", ["/favicon.ico"])).toBe(false);
    });

    it("should handle paths with query strings excluded from pattern", () => {
      expect(isExcludedPath("/favicon.ico", ["/favicon.ico"])).toBe(true);
    });
  });
});
