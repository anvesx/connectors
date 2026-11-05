# slack

- `connector.ts` `createSlackConnector`: `list`, `fetch`, `canRead`, `listMemberships`, `changes` over `@slack/web-api`
- `map.ts` channel to document, history to text, Slack error codes to connector errors, cursor paging
- `retry.ts` `rateLimitedFetch`: the `fetch` given to `WebClient` and the only place requests are retried: a 429 sleeps `Retry-After`, a 5xx or network failure sleeps a doubling backoff (500 ms first), all from one `retries` budget; it gives up at once when a `Retry-After` exceeds `maxWaitSeconds`
- `manifest.ts` the Slack catalog entry (`slackManifest`): OAuth v2, company zone
- `changes/` cursor is a message timestamp; one `upsert` per joined channel with newer messages
- `members/` `listSlackMembers`: `slack:workspace` pairs for active humans, `slack:channel:<id>` pairs for private channels

One channel is one document; its text is the last 200 messages, oldest first. A user token is needed (`xoxp`): a bot token only sees channels the bot joined.

`canRead` answers `false` only for `channel_not_found` and `not_in_channel`. Every other error goes through `guardSlack` like `list` and `fetch`: `invalid_auth`, `token_revoked`, `missing_scope` and the other forbidden codes become `ConnectorError` `FORBIDDEN`, a rate limit becomes `RATE_LIMITED`, and the SDK's raw error is never thrown.

Limits: `retries` (default 3; the SDK's own default is 10 over about 30 minutes) is ONE budget per request for 429s, 5xx and network failures together, so a request makes at most `retries + 1` HTTP calls. The client is built with the SDK's own `retryConfig.retries` at 0, because stacking its retries on `retry.ts` multiplied the calls (up to 16 for `retries` 3). `maxWaitSeconds` (default 60) caps one `Retry-After` wait. A 429 that outlasts the budget is `UpstreamLimitError` `RATE_LIMITED`; a 5xx that does, an HTTP error. Listing walks stop at `maxPages` (default 100 of 200 = 20,000 items) with `PAGE_LIMIT`, since memberships must be complete.
