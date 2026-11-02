# testing

Test servers that ship in the published package, so other repositories can run their own tests against the same fakes-free replay setup. They live in `src/` (not `tests/`) because `package.json` exports them and the build compiles `src`.

- `replay.ts` `fixture(name)` reads `tests/fixtures/<name>.json`; `startReplay(routes)` starts a local HTTP server that answers each path with a fixed or computed reply and records what it saw; exported as `@anvesx/connectors/testing/replay`
- `drive-server.ts` a stateful local Drive v3 server (files, permissions, changes, start token) the real `@googleapis/drive` client talks to; exported as `@anvesx/connectors/testing/drive-server`

The build copies `tests/fixtures` to `dist/tests/fixtures`, which is where `replay.ts` finds them after compilation.
