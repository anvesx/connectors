# Source layout

- `index.ts` public exports; it only re-exports, and every test imports through it
- `shared/` the `SourceConnector` type, ACL builder, HTTP error mapping and the replay test helper
- `github/` the GitHub adapter; `members/` holds team membership
- `drive/` the Google Drive adapter and the stateful Drive test server
- `slack/` the Slack adapter; `changes/` and `members/` hold its change feed and group membership
- `gmail/` the Gmail adapter
- `catalog/` the manifest type and registry, the built-in registry and the HTTP custom connector

Every folder keeps its tests in a `tests/` folder beside the code. Shared JSON fixtures live in the package `tests/fixtures`.
