# drive

- `connector.ts` `createDriveConnector`: `list`, `fetch`, `changes` over `@googleapis/drive`
- `map.ts` pure mapping from files, permissions and changes
- `changes.ts` start-token baseline and `changes.list` paging
- retry settings come from `shared/google/` (`retries`, `maxWaitSeconds`; 429, 5xx and quota 403s)
- `manifest.ts` the Drive catalog entry (`driveManifest`): sign-in settings and `load`

`canRead(address, {token})` asks Drive for the file with the asker's own token: true on 200, false on a plain 403 or 404; a quota 403 throws `RATE_LIMITED`, anything else throws. Drive group membership (`listMemberships`) is not built: it needs the Admin SDK or Cloud Identity, which the `drive` scope cannot reach.

Paging: `changes` reads at most `maxPages` pages (default 50 of 1000 = 50,000 changes). Drive tokens resume, so past the cap it returns the events so far and the next page token as `next`; call again to continue.
