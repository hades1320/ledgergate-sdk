/**
 * Converts a path exclusion pattern to a RegExp.
 * Escapes all regex special characters except `*`, which is treated as a wildcard.
 */
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
}

/**
 * Checks whether a given path matches any excluded path pattern.
 *
 * Patterns support:
 * - Exact matches: `"/favicon.ico"`
 * - Wildcard `*` matching any character sequence: `"/health/*"`, `"/static/*"`
 *
 * @param path - The request path to test
 * @param excludePaths - Array of path patterns to exclude
 * @returns `true` if the path should be excluded from SDK tracking
 */
export function isExcludedPath(
  path: string,
  excludePaths: readonly string[]
): boolean {
  return excludePaths.some((pattern) => {
    if (pattern.includes("*")) {
      return patternToRegex(pattern).test(path);
    }
    return path === pattern;
  });
}
