# tests

The real Gmail client against the replay server, one file per behaviour: `list.test.ts`, `fetch.test.ts`, `changes.test.ts`.
`server.ts` holds the routes, which follow the Gmail v1 REST paths. `edge/` has the boundary and error cases.
