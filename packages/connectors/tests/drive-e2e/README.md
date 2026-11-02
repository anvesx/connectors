# drive-e2e

The real `@googleapis/drive` client against `support/drive-server.ts`, a stateful local server for the Drive v3 REST
surface the connector uses. It is pointed at the server with the connector's existing `rootUrl` option.

- `list.test.ts` paging, ACL mapping, bad cursor, token required
- `fetch.test.ts` export and `alt=media` reads, 403/404/500, permission list
- `changes.test.ts` start token, paged change list, cursor handling
- `can-read.test.ts` 200, 403, 404, 500 for the asker's own token
- `seed.ts` the files and a connector wired to the server
