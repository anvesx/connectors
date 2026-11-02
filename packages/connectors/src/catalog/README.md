# catalog

The connector catalog. A `Manifest` is data (`id`, `name`, `auth` of `oauth2`, `token` or `pat`, `defaultZone`) plus `load(config)`, which builds one account's `Connector`.

- `registry/` `types.ts` (`Manifest`, `Auth`, `LoadConfig`; manifests with the same `auth.app` share one OAuth client) and `registry.ts` (`createRegistry()`: `register(manifest, tenant?)`, `get(id, tenant?)`, `list(tenant?)`; a tenant entry is visible only to that tenant and cannot reuse a built-in id)
- `builtin/` `createBuiltinRegistry()` (GitHub and Drive) and `hasLiveRecheck(manifest)`, true when the adapter has `canRead`
- `http/` `customManifest(spec)` wraps an HTTP endpoint that answers `POST /list`, `/fetch` and `/can-read` as a manifest. `canRead` exists only when the spec declares it

A new app is one folder with its adapter and `manifest.ts`, plus one line in `builtin/builtin.ts`. The repository README walks through it.
