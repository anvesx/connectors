# fixtures

JSON responses in the shapes documented by the GitHub REST and Google Drive v3 APIs: `github/` (repo, tree,
collaborators, teams, file content), `github-changes/` (branch, compare), `drive/` (file list, change list, file
metadata, start token, a 403 error body). They are fixtures, not live captures.

`slack/` (grouped in `channels/`, `history/`, `people/`, `errors/`) follows the Slack Web API: every reply is HTTP 200 with
`ok`, and failures are `ok: false` plus an `error` code. `gmail/` follows Gmail API v1. Also fixtures, not live captures.
