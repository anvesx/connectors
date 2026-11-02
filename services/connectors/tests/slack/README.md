# tests

The real Slack client against the replay server, one file per behaviour: `list.test.ts` and `fetch.test.ts`.
`server.ts` holds the routes; Slack's `ok: false` errors come back with HTTP 200, as in production.
`edge/` has the boundary and error cases and the helper the change and member tests share.
