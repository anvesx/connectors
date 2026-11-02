# drive

- `connector.ts` `createDriveConnector`: `list`, `fetch`, `changes` over `@googleapis/drive`
- `map.ts` pure mapping from files, permissions and changes
- `changes.ts` start-token baseline and `changes.list` paging

`canRead(address, {token})` asks Drive for the file with the asker's own token: true on 200, false on 403 or 404, anything else throws. Drive group membership (`listMemberships`) is not built: it needs the Admin SDK or Cloud Identity, which the `drive` scope cannot reach.
- `manifest.ts` the Drive catalog entry (`driveManifest`): sign-in settings and `load`
