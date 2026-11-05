import type { Octokit } from "@octokit/rest";

/** Per-request state kept on `options.request`, which every Octokit layer (retry, throttling, `retryAfter429`) sees for one logical request. */
export type Budgeted = { calls?: number; lastError?: unknown; retries?: number };

/** True while this request may still be retried: `calls` HTTP calls were made, the first is free, so up to `retries` more are allowed. */
export const hasBudget = (options: { request?: unknown }, retries: number): boolean => ((options.request as Budgeted | undefined)?.calls ?? 0) <= retries;

/**
 * An Octokit plugin that gives one request ONE retry budget shared by all layers. It must be registered first so it sits closest to the network:
 * it counts every real HTTP call, and once `retries + 1` calls were made it re-throws the last error instead of calling again (with the
 * retry plugin's own `retries` set to 0 so that layer does not sleep and loop). So 503s and 429s together never exceed `retries + 1` calls.
 */
export const sharedBudget = (retries: number) => (octokit: { hook: Octokit["hook"] }) => {
  octokit.hook.wrap("request", async (request, options) => {
    options.request = options.request ?? {};
    const state = options.request as Budgeted;
    if (!hasBudget(options, retries)) {
      state.retries = 0; // tells plugin-retry "no retries left"
      throw state.lastError;
    }
    state.calls = (state.calls ?? 0) + 1;
    try {
      return await request(options);
    } catch (error) {
      state.lastError = error;
      throw error;
    }
  });
  return {};
};
