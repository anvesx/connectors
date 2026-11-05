# @anvesx/connectors

A catalog of connector manifests and source adapters, built on the vendors' own SDKs: GitHub (`@octokit/rest`),
Google Drive (`@googleapis/drive`), Slack (`@slack/web-api`) and Gmail (`@googleapis/gmail`). Each adapter is a `Connector` from `@anvesx/connector-kit` with
`enforcesUserToken: true`, plus a `changes` method. OAuth is out of scope: callers pass tokens in.
Slack channels default to the company zone and Gmail messages to the personal zone; both implement `canRead`, and Slack also `listMemberships`.

The connector contract (`@anvesx/connector-kit`) and its shared types (`@anvesx/core-types`) are peer dependencies. They
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

## Limits

- **Rate limits.** Drive, Gmail and Slack take `retries` (default 3) and GitHub takes `maxRetries` (default 3); each must be an integer of at least 0, else creating the connector throws `RangeError`. Every adapter takes `maxWaitSeconds` (default 60). A limit that outlasts the retries throws `UpstreamLimitError` with code `RATE_LIMITED`.
  - **GitHub:** `@octokit/plugin-retry` (5xx), `plugin-throttling` (primary and secondary limits) and a small plugin for a plain 429 with `Retry-After`. That plugin steps aside when `x-ratelimit-remaining` is "0", the message says "secondary rate", or the body has `errors[].type` `RATE_LIMITED`, since the throttling plugin owns those. 5xx and rate limits share one budget per request, at most `maxRetries + 1` calls. A `Retry-After` above `maxWaitSeconds` fails at once for secondary limits and plain 429s; a primary limit waits until `x-ratelimit-reset` (not `Retry-After`) and fails at once when that wait is above `maxWaitSeconds`. A rate-limited 403 is `RATE_LIMITED`, not `FORBIDDEN`. An abort signal is honoured between calls, not during a `Retry-After` sleep, so an abort can land up to `maxWaitSeconds` late; no extra call is made.
  - **Drive and Gmail:** gaxios `retryConfig` (429, 408, 5xx and a 403 whose reason is `rateLimitExceeded` or `userRateLimitExceeded`, GET only; a plain 403 stays `FORBIDDEN`). A `Retry-After` above `maxWaitSeconds` fails at once.
  - **Slack:** the SDK's own sleep cannot be cut short, so a `fetch` wrapper is the only retry layer and the SDK's `retryConfig.retries` is 0. 429s, 5xx and network failures share one budget, at most `retries + 1` calls. A `Retry-After` above `maxWaitSeconds` fails at once; a missing or non-numeric one waits 1 second.
- **Paging.** Every paginated walk stops at `maxPages`. Defaults: GitHub 30 pages of 100 = 3000 items; Drive changes 50 pages of 1000 = 50,000 changes; Gmail changes 50 pages of 500 = 25,000 history records; Slack 100 pages of 200 = 20,000 items. Past the cap, GitHub and Slack throw `UpstreamLimitError` `PAGE_LIMIT`; Drive and Gmail `changes` return the events so far and a resumable cursor as `next` (Gmail: `<history id>:<page token>`). `maxPages` must be an integer of at least 1, else creating the connector throws `RangeError`. GitHub's commit compare lists files only on page 1 and at most 300 for the whole comparison, so it makes one request and throws `PAGE_LIMIT` at 300 files or more (exactly 300 cannot be told from more).

## Verify

```sh
pnpm test        # mapping tests, plus the adapters run against recorded fixtures
pnpm typecheck
```

`tests/` (mirroring `src/`) runs the real SDKs against a local HTTP server that answers with the JSON files in `tests/fixtures`.
Those fixtures follow the response shapes in the GitHub and Drive API docs; they were not captured from a live account.

### Live integration tests

`tests/github/live.test.ts` and `tests/drive/live.test.ts` call the real APIs and are skipped (`it.skipIf`) unless the environment is set:

```sh
GITHUB_TOKEN=ghp_... GITHUB_TEST_REPO=owner/repo pnpm test -- tests/github/live.test.ts
DRIVE_ACCESS_TOKEN=ya29... pnpm test -- tests/drive/live.test.ts   # OAuth token with drive.readonly
```

The GitHub token needs push access to the repo (collaborator listing) and `repo` read scope.

## Test support for consumers

`@anvesx/connectors/testing/replay` (`startReplay`, `fixture`) and `@anvesx/connectors/testing/drive-server`
(`startDrive`) are the same local servers this package's own tests use. Apps that consume the adapters can point the real
SDKs at them instead of mocking. The build copies `tests/fixtures` next to them (`dist/tests/fixtures`).
