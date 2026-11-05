# Source layout

- `index.ts` public exports; it only re-exports, and every test imports through it
- `shared/` the `SourceConnector` type, ACL builder, HTTP error mapping, `UpstreamLimitError`, the page-cap check; `google/` holds the retry settings Drive and Gmail share
- `github/` the GitHub adapter; `members/` holds team membership, `limits/` the retrying client, the plain-429 plugin and the capped paginator
- `drive/` the Google Drive adapter
- `testing/` the replay server and stateful Drive server that the package exports as `testing/replay` and `testing/drive-server`
- `slack/` the Slack adapter; `changes/` and `members/` hold its change feed and group membership
- `gmail/` the Gmail adapter
- `catalog/` the manifest type and registry, the built-in registry and the HTTP custom connector

Tests are not kept in `src/`: they live in the package `tests/` folder, which mirrors this layout, next to the shared JSON fixtures in `tests/fixtures`.
