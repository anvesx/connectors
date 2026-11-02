# bin

`cli.mjs` is the command behind `pnpm guard:fakes`. It scans the workspace with `scanRepo`, compares the findings with `fake-baseline.json` through `compare`, prints one line per problem plus a count of files checked, and exits 1 on any new or stale finding and 2 when it checked zero files. `--init` rewrites the baseline from the current findings and `--root <dir>` points it at another workspace.
