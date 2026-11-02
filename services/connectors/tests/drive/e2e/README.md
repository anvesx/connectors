# drive e2e tests

`seed.ts` boots the stateful Drive server from `src/testing/drive-server.ts` and a connector pointed at it; the `list`, `fetch` (with `canRead`) and `changes` tests each run against that server.
