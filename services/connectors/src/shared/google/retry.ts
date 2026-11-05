import { setTimeout as sleep } from "node:timers/promises";
import type { drive_v3 } from "@googleapis/drive";
import { DEFAULT_MAX_WAIT_SECONDS, GOOGLE_QUOTA_REASONS, retryCap } from "../limits.js";

// gaxios is not a direct dependency, so its types are read off the Drive client options that carry them (Gmail's are the same).
type RetryConfig = NonNullable<drive_v3.Options["retryConfig"]>;
type GaxiosError = Parameters<NonNullable<RetryConfig["retryBackoff"]>>[0];

export const DEFAULT_RETRIES = 3;

/** Seconds from a `Retry-After` header (gaxios exposes response headers as a fetch `Headers`); undefined when absent or not a whole number. */
const retryAfter = (error: GaxiosError): number | undefined => {
  const seconds = Number.parseInt(error.response?.headers.get("retry-after") ?? "", 10);
  return Number.isInteger(seconds) && seconds >= 0 ? seconds : undefined;
};

/** gaxios's own default is 429, 408, 1xx and 5xx; Google also reports a quota as 403 with a `usageLimits` reason. */
const retryable = (status: number | undefined, reason: unknown): boolean =>
  status === undefined || status === 408 || status === 429 || (status >= 500 && status < 600) || (status === 403 && GOOGLE_QUOTA_REASONS.has(reason));

/**
 * gaxios's own retry settings (gaxios/build/esm/src/retry.js: `config.shouldRetry || shouldRetryRequest`, then `config.retryBackoff`).
 * `shouldRetry` replaces gaxios's default check, so it repeats the parts we keep: GET only, `retries` attempts, and a request that got no
 * response is tried at most twice. It also refuses a `Retry-After` above `maxWaitSeconds`, so that fails at once instead of sleeping.
 * `retryBackoff` sleeps for the longer of `Retry-After` and gaxios's backoff, never more than `maxWaitSeconds`.
 */
export const googleRetry = (configured?: number, maxWaitSeconds: number = DEFAULT_MAX_WAIT_SECONDS): RetryConfig => {
  // A guard for direct callers; this runs per request (the Google client is built per call), so the connectors also check at
  // construction. NaN would otherwise mean "retry forever": `attempt >= NaN` is never true.
  const retries = retryCap(configured, DEFAULT_RETRIES);
  return {
    retry: retries,
    shouldRetry: (error) => {
      const attempt = error.config.retryConfig?.currentRetryAttempt ?? 0;
      const data = error.response?.data as { error?: { errors?: { reason?: unknown }[] } } | undefined;
      if (attempt >= retries || (error.config.method ?? "GET").toUpperCase() !== "GET") return false;
      if (error.response === undefined) return attempt < 2;
      if ((retryAfter(error) ?? 0) > maxWaitSeconds) return false;
      return retryable(error.response.status, data?.error?.errors?.[0]?.reason);
    },
    retryBackoff: (error, backoffMs) => sleep(Math.min(Math.max((retryAfter(error) ?? 0) * 1000, backoffMs), maxWaitSeconds * 1000)),
  };
};
