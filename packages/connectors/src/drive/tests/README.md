# tests

- `drive-server.ts` a stateful local Drive v3 server; also published as `@anvesx/connectors/testing/drive-server`
- `map.test.ts` file, permission and change mapping against fixtures
- `live.test.ts` the real Drive API, skipped unless `DRIVE_ACCESS_TOKEN` is set
- `e2e/` the real Drive client against the stateful server
- `replay/` the real Drive client against fixture replay
