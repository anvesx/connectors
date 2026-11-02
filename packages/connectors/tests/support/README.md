# support

`replay.ts` loads fixture JSON and starts a local HTTP server that serves it per pathname, recording the paths and
`authorization` headers it saw.

`drive-server.ts` is a stateful local Google Drive v3 server (paged files.list and changes.list, files.get with
`alt=media`, files.export, permissions.list, 401/403/404/500 paths). Tests mutate its `files` and `changes`.
