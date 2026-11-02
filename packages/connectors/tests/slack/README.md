# slack tests

The real `@slack/web-api` client against a local HTTP server (`../support/replay.ts`) that answers with
`../fixtures/slack/` JSON. `server.ts` holds the routes; Slack's `ok: false` errors come back with HTTP 200, as in production.

- `list.test.ts` paging, ACLs, zone, cursor and limit errors
- `fetch.test.ts` history text, error mapping, `canRead`
- `members.test.ts` `listMemberships`
- `changes.test.ts` baseline, since-cursor events, bad cursor
