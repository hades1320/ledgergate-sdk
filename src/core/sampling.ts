/**
 * Determines if a request should be sampled based on the configured rate
 * @param rate - Sampling rate between 0 (0%) and 1 (100%)
 * @returns true if the request should be sampled
 */
export function shouldSample(rate: number): boolean {
  if (rate <= 0) {
    return false;
  }
  if (rate >= 1) {
    return true;
  }
  return Math.random() < rate;
}
