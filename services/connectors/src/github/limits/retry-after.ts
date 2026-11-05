import { setTimeout as sleep } from "node:timers/promises";
import type { Octokit } from "@octokit/rest";
import { hasBudget } from "./budget.js";

type Limited = { status?: number; message?: string; response?: { headers?: Record<string, unknown>; data?: { errors?: { type?: string }[] } } };

/**
 * An Octokit plugin for the 429 that the throttling plugin does not handle: one with a `Retry-After` header, no "secondary rate" message,
 * `x-ratelimit-remaining` not "0" and no `errors[].type === "RATE_LIMITED"` in the body (the throttling plugin owns those, so retrying them here
 * too would double the calls). Waits `Retry-After` seconds (times `msPerSecond`) and tries again while the shared budget (see `budget.ts`) lasts
 * and never when the wait is over `maxWaitSeconds`; otherwise the error goes on to `toConnectorError`.
 */
export const retryAfter429 = (retries: number, maxWaitSeconds: number, msPerSecond: number) => (octokit: { hook: Octokit["hook"] }) => {
  octokit.hook.wrap("request", async (request, options) => {
    // This is the outermost layer, so the budget counters (see `budget.ts`) start here. When a call passes no `request` option, `options.request`
    // is the client-wide default object, shared by every request, so it must be copied, never changed in place. before-after-hook runs the
    // inner layers (retry, throttling, budget) on this same `options` object, so they all see the copy.
    options.request = { ...options.request, calls: 0, lastError: undefined, retries: undefined };
    for (;;) {
      try {
        return await request(options);
      } catch (error) {
        const e = error as Limited;
        if (e.response?.headers?.["x-ratelimit-remaining"] === "0") throw error;
        if ((e.response?.data?.errors ?? []).some((x) => x.type === "RATE_LIMITED")) throw error;
        const seconds = Number(e.response?.headers?.["retry-after"]);
        if (e.status !== 429 || /\bsecondary rate\b/i.test(e.message ?? "") || !(seconds >= 0) || seconds > maxWaitSeconds || !hasBudget(options, retries))
          throw error;
        await sleep(seconds * msPerSecond);
      }
    }
  });
  return {};
};
