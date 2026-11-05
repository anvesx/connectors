# github retry tests

Real Octokit, real plugins, real local HTTP server (`startReplay`); nothing is mocked.

- `retry-after.test.ts` a plain 429 with only `Retry-After` is retried, bounded by `maxRetries` and `maxWaitSeconds`; rate-limited 403s are `RATE_LIMITED`
- `double-retry.test.ts` a 429 with `x-ratelimit-remaining: 0` and `Retry-After` is retried by the throttling plugin only (`maxRetries` + 1 calls); a plain 429 with `Retry-After` is also `maxRetries` + 1; a 429 with `errors[].type: RATE_LIMITED` in the body is also `maxRetries` + 1
- `budget.test.ts` alternating 503 and 429 share the one `maxRetries` budget: 4 calls with `maxRetries` 3
- `concurrent.test.ts` the budget is per request: concurrent requests and paginated walks on one client, and a request that always fails beside others that succeed, each get exactly `maxRetries` + 1 calls
