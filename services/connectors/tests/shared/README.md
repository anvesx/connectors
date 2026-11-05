# shared tests

- `shared.test.ts` ACL building (sorted, de-duplicated principals, stable version digest) and HTTP error mapping

- `limits/` the Google retry check (see its README)
- `limits.test.ts` `pageCap` accepts only integers of 1 or more, connector creation throws `RangeError` otherwise, and the `isRateLimited` cases

The replay helper these tests and every adapter test use is `src/testing/replay.ts`; fixtures are read from `tests/fixtures`.
