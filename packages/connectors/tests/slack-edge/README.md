# slack edge tests

Boundary and error cases for the Slack adapter, added to kill surviving mutants. Each test drives the real
`@slack/web-api` client against a local HTTP server (`../support/replay.ts`) with inline JSON replies.

- `helper.ts` inline server and request-parameter reader
- `paging.test.ts` cursor following in `listMemberships`
- `changes.test.ts` newest-timestamp selection and empty channels
- `connector.test.ts` limit bounds, error messages, text fallbacks, manifest `baseUrl`
