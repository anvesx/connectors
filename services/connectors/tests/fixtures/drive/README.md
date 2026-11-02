# drive fixtures

Google Drive v3 replies the replay tests feed to the real `@googleapis/drive` client.

- `files-list.json` a `drive#fileList` with a `nextPageToken` and the file `Leave policy` (id, mime type, version `42`, `modifiedTime`) carrying owner, reader, group, domain and further permissions that map to an ACL
- `file-meta.json` one Google Docs file (`id`, `mimeType`, `version`), used by `fetch` and by the `canRead` check

The change feed replies are in `changes/`; the 403 body that means "no access" is in `errors/`.
