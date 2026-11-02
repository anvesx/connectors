# @anvesx/connectors

A catalog of connector manifests and source adapters, built on the vendors' own SDKs: GitHub (`@octokit/rest`),
Google Drive (`@googleapis/drive`), Slack (`@slack/web-api`) and Gmail (`@googleapis/gmail`). Each adapter is a `Connector` from `@brain/connector-kit` with
`enforcesUserToken: true`, plus a `changes` method. OAuth is out of scope: callers pass tokens in.
Slack channels default to the company zone and Gmail messages to the personal zone; both implement `canRead`, and Slack also `listMemberships`.

The connector contract (`@brain/connector-kit`) and its shared types (`@brain/core-types`) are peer dependencies. They
are not published yet, so the repository README explains how they are resolved for now.

## Interface

```ts
import { createDriveConnector, createGithubConnector } from "@anvesx/connectors";

const github = createGithubConnector({ id: "gh", owner: "acme", repo: "handbook", listToken: INDEXER_TOKEN });
const { items, nextCursor } = await github.list({ limit: 100 }); // documents plus ACLs
const { text, version } = await github.fetch(items[0]!.address, { token: USER_TOKEN }); // the caller's own token
const baseline = await github.changes({ token: INDEXER_TOKEN }); // { events: [], next: <cursor> }
const delta = await github.changes({ token: INDEXER_TOKEN, cursor: baseline.next });
```

- `list` has no per-call token in the `Connector` contract, so it uses `listToken` (an indexing identity). `fetch` and
  `changes` use the token passed in the call. A new SDK client is built per call, so tokens are never shared.
- `fetch` maps HTTP 404 to `NOT_FOUND` and 401/403 to `FORBIDDEN` (the `ConnectorError` codes connector-kit defines).
  A malformed or stale cursor throws `BAD_CURSOR`.
- `changes` without a cursor returns a baseline; an event is `{ address, kind: "upsert" | "delete" }`.

|                  | GitHub                                                                                       | Google Drive                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Document         | text blob on the default branch (at most 1 MB), address is the path, version is the blob SHA | text file or Google Doc, address is the file id, version is Drive's `version` |
| ACL              | repo collaborators as users; teams as `owner/slug` groups; public repos add group `public`   | live grants: users and groups by email, `domain:<name>`, `anyone`             |
| `list` cursor    | `<tree sha>:<offset>`, stable across pushes                                                  | Drive page token, passed through                                              |
| `changes` cursor | commit SHA; compare against the head                                                         | Drive change page token                                                       |
| Options          | `baseUrl` (GitHub Enterprise)                                                                | `rootUrl`                                                                     |

Known limits: the GitHub ACL is repo-level (listing collaborators needs push access for `listToken`), not per file;
Drive `permissions` in `files.list` can be incomplete for files the indexer cannot share.

## Verify

```sh
pnpm test        # mapping tests, plus the adapters run against recorded fixtures
pnpm typecheck
```

`tests/replay` runs the real SDKs against a local HTTP server that answers with the JSON files in `tests/fixtures`.
Those fixtures follow the response shapes in the GitHub and Drive API docs; they were not captured from a live account.

### Live integration tests

`tests/integration` calls the real APIs and is skipped (`it.skipIf`) unless the environment is set:

```sh
GITHUB_TOKEN=ghp_... GITHUB_TEST_REPO=owner/repo pnpm test -- tests/integration/github.live.test.ts
DRIVE_ACCESS_TOKEN=ya29... pnpm test -- tests/integration/drive.live.test.ts   # OAuth token with drive.readonly
```

The GitHub token needs push access to the repo (collaborator listing) and `repo` read scope.

## Test support for consumers

`@anvesx/connectors/testing/replay` (`startReplay`, `fixture`) and `@anvesx/connectors/testing/drive-server`
(`startDrive`) are the same local servers this package's own tests use. Apps that consume the adapters can point the real
SDKs at them instead of mocking. The build copies `tests/fixtures` next to them.
