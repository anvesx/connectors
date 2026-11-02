# fixtures

JSON replies in the shapes documented by each vendor API. The replay servers in `src/testing/replay.ts` and the
stateful Drive server answer HTTP requests with these files, so the real vendor SDKs run against realistic bodies
without network access. They are written to match the documented shapes, not captured from live accounts.

- `github/` repository, tree and file content (REST v3)
- `github-changes/` branch head and compare result used by the change feed
- `github-members/` collaborators, teams and per-team member lists
- `drive/` Google Drive v3 file metadata and file list, plus `changes/` and `errors/`
- `slack/` Slack Web API replies; every reply is HTTP 200 with `ok`, failures are `ok: false` plus an `error` code
- `gmail/` Gmail API v1 replies, including `profile.json` (mailbox address and history id)

A fixture is addressed without its extension, for example `fixture("github/repo")`. Keep each folder to five
files including this README; add a sub-folder when a family grows.
