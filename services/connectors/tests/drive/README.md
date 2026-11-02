# drive tests

- `map.test.ts` file, permission and change mapping against fixtures
- `live.test.ts` the real Drive API, skipped unless `DRIVE_ACCESS_TOKEN` is set
- `e2e/` the real Drive client against the stateful Drive server in `src/testing/drive-server.ts`
- `replay/` the real Drive client against fixture replay
