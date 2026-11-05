# github/limits

- `octokit.ts` `createClient`: Octokit with `@octokit/plugin-retry` (5xx) and `@octokit/plugin-throttling` (primary and secondary limits: a primary limit waits until `x-ratelimit-reset` and ignores `Retry-After`; a secondary limit uses `Retry-After`); a wait longer than `maxWaitSeconds` fails at once
- `budget.ts` `sharedBudget`: counts every HTTP call of one logical request (its own copy of `options.request`, made in `retry-after.ts`, so concurrent requests on one client never share a count) and stops all layers at `maxRetries + 1` calls
- `retry-after.ts` `retryAfter429`: retries a 429 with `Retry-After` that the throttling plugin does not handle (no "secondary rate" message, `x-ratelimit-remaining` not "0", no `errors[].type` of `RATE_LIMITED` in the body); honours the shared budget and `maxWaitSeconds`
- `paginate.ts` `paginateCapped`: `octokit.paginate.iterator` with a page cap; throws `PAGE_LIMIT` if more pages remain

`createClient` takes `{ maxRetries, maxWaitSeconds }`. `maxRetries` (default 3) is one budget per logical request (each `octokit.request` call or each paginated page) for 5xx, primary, secondary and plain 429 limits together, and must be an integer of at least 0 (`RangeError` otherwise, when the connector is created): alternating 503 and 429 still makes at most `maxRetries + 1` = 4 calls. Its `msPerSecond` (a test-only clock scale) is not on `GithubConfig`; only `buildGithubConnector` in `connector.ts` accepts it, and `index.ts` does not export that.

A rate limit that outlasts the retries surfaces as `UpstreamLimitError` with code `RATE_LIMITED` (see `shared/errors.ts`).
