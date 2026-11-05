# slack limits tests

Real `@slack/web-api` client against a real local HTTP server; nothing is mocked.

- `rate-limit.test.ts` a 429 is retried after `Retry-After` with the default `retries`, then succeeds; retries are bounded
- `max-wait.test.ts` `Retry-After` 3600 fails at once after one call; over `maxWaitSeconds` fails, equal to it is honoured, a missing header waits 1 s
- `paging.test.ts` a server that always returns a next cursor stops at `maxPages` with `PAGE_LIMIT`
- `can-read.test.ts` `canRead` on an always-429 server with `retries` 0 raises `RATE_LIMITED`, not the SDK's platform error
- `retry/` `budget.test.ts`: 429, 5xx and mixes share one `retries` budget (at most `retries + 1` calls)
