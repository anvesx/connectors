# github

- `connector.ts` `createGithubConnector`: `list`, `fetch`, `changes` over `@octokit/rest`; also implements `canRead`, a repo-level read with the asker's token (404 and 403 mean no; a rate limit is `RATE_LIMITED` and a 401 is `ConnectorError` `FORBIDDEN`, both through `toConnectorError`, never a raw Octokit error)
- `map.ts` pure mapping from tree entries, collaborators, teams and compare files
- `changes.ts` head lookup and commit-compare change feed (one request: compare lists files only on page 1, at most 300)
- `manifest.ts` the GitHub catalog entry (`githubManifest`); its `load` needs a `repo`
- `members/` `listTeamMembers`: one `owner/slug` pair per member of each team with repo access
- `limits/` the rate-limit-aware Octokit client and the page-capped paginator

Paging caps: `maxPages` (default 30 pages of 100 = 3000 items per walk). A walk that would exceed it throws `PAGE_LIMIT`: ACLs must be complete. A compare diff of 300 or more files also throws `PAGE_LIMIT`, since GitHub stops listing there.
