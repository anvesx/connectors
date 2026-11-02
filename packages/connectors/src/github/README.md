# github

- `connector.ts` `createGithubConnector`: `list`, `fetch`, `changes` over `@octokit/rest`; also implements `canRead`, a repo-level read with the asker's token (404 and 403 mean no)
- `map.ts` pure mapping from tree entries, collaborators, teams and compare files
- `changes.ts` head lookup and commit-compare change feed
- `manifest.ts` the GitHub catalog entry (`githubManifest`); its `load` needs a `repo`
- `members/` `listTeamMembers`: one `owner/slug` pair per member of each team with repo access
