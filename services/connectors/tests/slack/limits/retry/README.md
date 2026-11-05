# slack retry budget tests

Real `@slack/web-api` client against a real local HTTP server; nothing is mocked.

- `budget.test.ts` 429s, 5xx and their mixes share one `retries` budget per request: total calls never exceed `retries + 1`
