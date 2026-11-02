# shared

- `types.ts` `SourceConnector` (a `Connector` plus `changes`), `ChangeEvent`, `CommonConfig`
- `acl.ts` `buildAcl`: sorted principals with a deterministic version digest
- `errors.ts` `guarded` and `toConnectorError`: 404 to `NOT_FOUND`, 401/403 to `FORBIDDEN`
