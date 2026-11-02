25%

# connectors

A catalog of connectors that let software read documents from other apps, and a small set of adapters that do the
reading. Today it ships Google Drive, GitHub, Slack and Gmail. Anyone can add another app, and a company can plug in its own system
over plain HTTP without changing this repository.

The only package is `packages/connectors`, published as `@anvesx/connectors`. Its own README lists the API.

## What a manifest is

A manifest is a small piece of data that describes one app. It holds:

- `id` and `name`: a lowercase id such as `github`, and a display name.
- `auth`: how a person signs in. One of `oauth2` (with authorize URL, token URL and scopes), `token`, or `pat`
  (a personal access token the person pastes in).
- `defaultZone`: who may read the documents it brings in. `company`, `personal` or `private`.
- `load(config)`: a function that builds the adapter for one account.

The adapter is a `Connector`. It can `list` documents with their access lists, `fetch` one document with the
caller's own token, report `changes` since a cursor, and, if the source supports it, answer `canRead` for one
person. A connector with no `canRead` can only hold personal data, because nobody can re-check its permissions.

A registry holds manifests. Code that signs people in or syncs documents asks the registry what exists, so it never
names an app directly. Manifests that share an `auth.app` value share one OAuth client.

## Add an app

1. Make a folder under `packages/connectors/src/<app>/` with `connector.ts` (the adapter) and `manifest.ts`.
2. Write the failing tests first in `packages/connectors/tests/`. Run the real vendor SDK against a local HTTP
   server that answers with recorded JSON, as `tests/replay` does for GitHub and Drive.
3. Export the manifest and add one line to `src/catalog/builtin.ts` that registers it.
4. Add a `README.md` to the new folder.

Nothing else changes. Sign-in screens and sync code read the registry, so the new app appears on its own.

## Add a custom HTTP connector

A company with an internal system does not need a code change here. It runs an HTTP service that accepts `POST`
requests with a bearer token and a JSON body:

- `POST /list` takes the query and answers `{ items: [{ address, title, version, updatedAt, acl }], nextCursor? }`.
- `POST /fetch` takes `{ address }` and answers `{ text, version }`.
- `POST /can-read` takes `{ address }` and answers `{ allowed: true }` or `{ allowed: false }`. It is optional.

Then it registers the service with `customManifest({ id, name, auth, defaultZone, endpoint, canRead })` and adds the
result to a registry for its own tenant: `registry.register(manifest, tenantId)`. Other tenants never see it. The
endpoint cannot choose its own zone, every listed document takes `defaultZone`, and the response shape is checked
before use. Set `canRead` to `true` only if the service implements `/can-read`.

## Shared contracts

The `Connector` type lives in `@anvesx/connector-kit` and the shared types in `@anvesx/core-types`, both in
[anvesx/company-brain](https://github.com/anvesx/company-brain) under `features/`. This package lists them as peer
dependencies. They are not on any registry yet, and a git install cannot work: the packages have no build output in
git and depend on each other through `workspace:*`. Until a registry is chosen, a development install links a
sibling checkout:

```sh
git clone https://github.com/anvesx/company-brain.git ../company-brain
(cd ../company-brain && pnpm install --filter @anvesx/connector-kit... && pnpm --filter @anvesx/core-types --filter @anvesx/connector-kit build)
pnpm install
```

CI does the same steps before it installs this repository.

## Develop

```sh
pnpm test        # Vitest, one package at a time through turbo
pnpm typecheck
pnpm lint        # Biome
pnpm structure   # files at most 80 lines, at most 5 files per folder, a README in every folder
pnpm guard:fakes # no mocks or in-memory stand-ins in integration tests
```

Commits follow Conventional Commits, with body lines of at most 100 columns. Hooks run through lefthook and must not
be bypassed.
