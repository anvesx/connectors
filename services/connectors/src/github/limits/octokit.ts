import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";
import { DEFAULT_MAX_WAIT_SECONDS, retryCap } from "../../shared/limits.js";
import { hasBudget, sharedBudget } from "./budget.js";
import { retryAfter429 } from "./retry-after.js";

export type LimitOptions = {
  /** Retries per request after the first try, 5xx and rate limits together (one shared budget, so at most `maxRetries + 1` HTTP calls). Default 3. */
  maxRetries?: number;
  /** Longest Retry-After, in seconds, the client will sleep through; a longer wait fails at once. Default 60. */
  maxWaitSeconds?: number;
};

/** Test-only: milliseconds one Retry-After second is worth (default 1000). Tests lower it so they do not sleep; it is not part of the public config. */
export type InternalLimits = { msPerSecond?: number };

export const DEFAULT_RETRIES = 3;

/**
 * The plugin calls these handlers when GitHub says "slow down". Returning true means "wait `retryAfter` seconds and try again";
 * false lets the error through, and `toConnectorError` turns it into RATE_LIMITED.
 */
export const createClient = (token: string, baseUrl: string | undefined, limits: LimitOptions & InternalLimits = {}): Octokit => {
  const retries = retryCap(limits.maxRetries, DEFAULT_RETRIES); // throws RangeError for -1 or 1.5
  const maxWait = limits.maxWaitSeconds ?? DEFAULT_MAX_WAIT_SECONDS;
  const msPerSecond = limits.msPerSecond ?? 1000;
  // `hasBudget` checks the budget shared with the other layers, so rate limits and 5xx together never exceed `retries` retries.
  const shouldRetry = (retryAfter: number, options: { request?: unknown }): boolean => hasBudget(options, retries) && retryAfter <= maxWait;
  // Plugins, innermost first: `sharedBudget` counts every HTTP call, `retry` for 5xx, `throttling` for primary and secondary rate limits,
  // `retryAfter429` for a 429 with only a Retry-After header. Order matters: a later plugin wraps the earlier ones.
  const Client = Octokit.plugin(sharedBudget(retries), retry, throttling, retryAfter429(retries, maxWait, msPerSecond));
  return new Client({
    auth: token,
    ...(baseUrl && { baseUrl }),
    // 403 and 429 are left to the throttling plugin (the retry plugin never retries 403 by default), so one rate limit is never retried by both.
    retry: { retries, doNotRetry: [400, 401, 403, 404, 410, 422, 429, 451], retryAfterBaseValue: msPerSecond },
    throttle: { onRateLimit: shouldRetry, onSecondaryRateLimit: shouldRetry, retryAfterBaseValue: msPerSecond },
  });
};
