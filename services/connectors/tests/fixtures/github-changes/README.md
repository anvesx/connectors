# github-changes fixtures

Replies the commit-compare change feed needs after the first listing.

- `branch.json` the `main` branch with its head commit SHA, which is the cursor handed back to the caller
- `compare.json` a compare result with `status: ahead`, `ahead_by: 2` and four changed files in the states `modified`, `added`, `removed` and `renamed` (with `previous_filename`)

The tests assert on every filename and status in these files.
