# gmail limits tests

Real Gmail client (googleapis and gaxios) against a real local HTTP server; nothing is mocked.

- `rate-limit.test.ts` a 429 is retried after `Retry-After`, a quota 403 is retried then `RATE_LIMITED`, default 3 retries, `maxWaitSeconds` fails at once, a plain 403 is `FORBIDDEN`
- `paging.test.ts` `changes` stops at `maxPages` with a cursor `<history id>:<page token>` that resumes, the default is 50 pages, a malformed cursor is `BAD_CURSOR`
- `can-read.test.ts` `canRead` on a quota 403 (`userRateLimitExceeded`) with `retries` 1 makes 2 calls and raises `RATE_LIMITED`, not `false`
