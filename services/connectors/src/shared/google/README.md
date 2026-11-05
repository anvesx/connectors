# shared/google

- `retry.ts` `googleRetry`: the gaxios `retryConfig` for the Drive and Gmail clients. It retries 429, 408, 5xx and Google's quota 403s (reason `rateLimitExceeded` or `userRateLimitExceeded`) up to `retries` times (default 3). The wait is the longer of `Retry-After` and gaxios's backoff, at most `maxWaitSeconds` (default 60); a `Retry-After` above that fails at once with no sleep.

A limit that outlasts the retries surfaces as `UpstreamLimitError` with code `RATE_LIMITED` (see `shared/errors.ts`). A 403 with any other reason stays `FORBIDDEN` and is never retried.
