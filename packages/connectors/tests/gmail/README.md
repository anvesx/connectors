# gmail tests

The real Gmail client (`@googleapis/gmail`, the googleapis Gmail package) against a local HTTP server
(`../support/replay.ts`) that answers with `../fixtures/gmail/` JSON. `server.ts` holds the routes.

- `list.test.ts` paging, personal zone, owner-only ACL, cursor and limit errors
- `fetch.test.ts` text decoding, error mapping, `canRead`
- `changes.test.ts` baseline, history paging, expired cursor
