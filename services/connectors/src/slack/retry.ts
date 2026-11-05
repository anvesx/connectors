import { setTimeout as sleep } from "node:timers/promises";

/** What the SDK reads as an API error: HTTP 200 with `ok: false`. Slack's own code for a rate limit is `ratelimited`. */
export const RATE_LIMITED_CODE = "ratelimited";

/** First wait, in milliseconds, before retrying a 5xx or a network failure; it doubles on each further retry (500, 1000, 2000 ...). */
export const BACKOFF_MS = 500;

/**
 * A `fetch` for the SDK's `fetch` option (WebClient.js:123, `FetchFunction`), and the ONLY place requests are retried (the client is built with
 * the SDK's `retryConfig.retries` set to 0). The SDK sleeps a whole `Retry-After` on a 429 with no way to cut it short (WebClient.js:429-451),
 * and stacking its retries on top of these would multiply the calls. So one request makes at most `retries + 1` HTTP calls in total:
 * a 429 waits `Retry-After` seconds, a 5xx or a network failure waits the doubling backoff. When it must give up (budget used, or `Retry-After`
 * above `maxWaitSeconds`, with no sleep) a 429 becomes an `ok: false, error: "ratelimited"` reply, which the SDK throws at once as a platform
 * error; a 5xx is returned as is (the SDK throws an HTTP error); a network failure is re-thrown.
 */
export const rateLimitedFetch =
  (retries: number, maxWaitSeconds: number, backoffMs = BACKOFF_MS): typeof fetch =>
  async (input, init) => {
    for (let attempt = 0; ; attempt++) {
      const last = attempt >= retries; // true when no retry is left after this call
      let response: Response;
      try {
        response = await fetch(input, init);
      } catch (error) {
        if (last || init?.signal?.aborted) throw error; // a network failure: retry it unless the budget is used or the caller cancelled
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      if (response.status < 429 || (response.status > 429 && response.status < 500)) return response;
      if (response.status >= 500) {
        if (last) return response;
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      const header = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
      const seconds = Number.isNaN(header) ? 1 : header;
      if (last || seconds > maxWaitSeconds) {
        return new Response(JSON.stringify({ ok: false, error: RATE_LIMITED_CODE }), { status: 200, headers: { "content-type": "application/json" } });
      }
      await sleep(seconds * 1000);
    }
  };
