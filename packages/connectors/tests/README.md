# tests

- `unit/` mapping logic against the fixtures
- `replay/` the real SDKs against a local HTTP server that answers with fixtures
- `drive-e2e/` the real Drive client against the stateful Drive server in `support/`
- `slack/` the real Slack client against the replay server, one file per behaviour
- `gmail/` the real Gmail client against the replay server, one file per behaviour
- `slack-edge/` and `gmail-edge/` boundary and error cases that kill surviving mutants (see `pnpm mutate`)
- `integration/` live API tests, skipped unless `GITHUB_TOKEN` and `GITHUB_TEST_REPO`, or `DRIVE_ACCESS_TOKEN`, are set
- `fixtures/` recorded-shape JSON responses, see the package README
- `support/` fixture loader and the local replay server
- `catalog/` the registry, the built-in manifests and the HTTP custom connector (a local HTTP server)
