# gmail edge tests

Boundary and error cases for the Gmail adapter, added to kill surviving mutants. Each test drives the real
`@googleapis/gmail` client against a local HTTP server (`../support/replay.ts`) with inline JSON replies.

- `helper.ts` inline server, message builder and request-parameter reader
- `list.test.ts` limit bounds, request parameters, error mapping
- `fetch.test.ts` plain-text search, missing headers, `canRead` and manifest `rootUrl`
- `changes.test.ts` cursor shape, error mapping, history events
