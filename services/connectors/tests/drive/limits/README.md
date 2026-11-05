# drive limits tests

Real Drive client (googleapis and gaxios) against a real local HTTP server; nothing is mocked.

- `rate-limit.test.ts` a 429 is retried after `Retry-After` and then succeeds, retries are bounded, 5xx is retried, a 403 is not
- `quota.test.ts` a 403 with reason `rateLimitExceeded` or `userRateLimitExceeded` is retried, then `RATE_LIMITED`; a plain 403 stays `FORBIDDEN`; `canRead`
- `max-wait.test.ts` `Retry-After` 3600 fails at once; the 60 s default and the backoff clamp; 400 is not retried
- `paging.test.ts` a server that always returns a next page token stops at `maxPages` with a resumable cursor
