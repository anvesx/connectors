# github limits tests

Real Octokit, real plugins, real local HTTP server (`startReplay`); nothing is mocked.

- `rate-limit.test.ts` secondary and primary rate limits are retried and then succeed, retries are bounded, 5xx is retried, a plain 403 is not
- `paging.test.ts` a server that always offers a next page stops at `maxPages` with `PAGE_LIMIT`
- `compare.test.ts` compare is one request with `per_page=1`; 299 files pass, 300 is `PAGE_LIMIT`
- `retry/` the 429 `Retry-After` plugin and the throttling plugin: who retries which 429, and how often (see its README)
