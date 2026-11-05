# shared limits tests

- `google-retry.test.ts` `googleRetry(3, 60).shouldRetry` retries a 429 for GET or no method, never for POST, PUT, DELETE or PATCH, and not past 3 attempts
