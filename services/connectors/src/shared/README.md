# shared

- `types.ts` `SourceConnector` (a `Connector` plus `changes`), `ChangeEvent`, `CommonConfig`
- `acl.ts` `buildAcl`: sorted principals with a deterministic version digest
- `errors.ts` `guarded` and `toConnectorError`: 404 to `NOT_FOUND`, 401/403 to `FORBIDDEN`, a rate limit that outlasted retries to `RATE_LIMITED`
- `limits.ts` `UpstreamLimitError` (`RATE_LIMITED`, `PAGE_LIMIT`), `pageCap` (validates `maxPages`), `isRateLimited` (429, a 403 with `Retry-After`, a 403 with `x-ratelimit-remaining: 0`, or a Google quota 403), `DEFAULT_MAX_WAIT_SECONDS`
- `google/` `googleRetry`: the gaxios `retryConfig` Drive and Gmail share (see its README)

Tests are in the package `tests/shared/`; the replay helper is in `testing/`.
