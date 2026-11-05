# github tests

- `connector.test.ts` the real Octokit client against fixture replay; `msPerSecond` is rejected on the public config at compile time
- `can-read.test.ts` `canRead` with the asker's token
- `map.test.ts` tree, ACL, blob and compare mapping
- `live.test.ts` the real GitHub API, skipped unless `GITHUB_TOKEN` and `GITHUB_TEST_REPO` are set
- `members/` `listTeamMembers` against replay
