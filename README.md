25%

# connectors

A catalog of connectors that let software read documents from other apps, and a small set of adapters that do the
reading. Today it ships Google Drive, GitHub, Slack and Gmail. Anyone can add another app, and a company can plug in its own system
over plain HTTP without changing this repository.

The only package is `services/connectors`, published as `@anvesx/connectors`. Its own README lists the API.

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

1. Make a folder under `services/connectors/src/<app>/` with `connector.ts` (the adapter) and `manifest.ts`.
2. Write the failing tests first in `services/connectors/tests/`. Run the real vendor SDK against a local HTTP
   server that answers with recorded JSON, as `src/testing/replay.ts` does for GitHub and Drive.
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

The `Connector` type lives in `@anvesx/connector-kit` and the shared types in `@anvesx/core-types`. Both are
published from [anvesx/company-brain](https://github.com/anvesx/company-brain) to GitHub Packages, and this package
lists them as peer dependencies and installs them as dev dependencies at `0.1.0`.

GitHub Packages needs a token even for public packages. `.npmrc` points the `@anvesx` scope at
`https://npm.pkg.github.com` and reads the token from `NODE_AUTH_TOKEN`. Before `pnpm install`, export a classic
personal access token with `read:packages`:

```sh
export NODE_AUTH_TOKEN=<token with read:packages>
pnpm install
```

CI uses the repository secret `NPM_READ_TOKEN` for the same purpose, because the Actions `GITHUB_TOKEN` cannot read
packages owned by another repository. The structure lint still comes from a sibling checkout of company-brain:

```sh
git clone https://github.com/anvesx/company-brain.git ../company-brain
```

## Release

Describe a change with `pnpm changeset` and commit the file. The `release` workflow runs on every push to `main`,
builds the package and publishes `@anvesx/connectors` to GitHub Packages with the Actions `GITHUB_TOKEN` when its
version is not on the registry yet.

## Develop

```sh
pnpm test        # Vitest, one package at a time through turbo
pnpm typecheck
pnpm lint        # Biome
pnpm structure   # strict lint from company-brain/tools/structure-lint (needs the sibling checkout from above): files at most 80 lines, at most 5 per folder, README everywhere, tests in tests/ beside src
pnpm guard:fakes # no mocks or in-memory stand-ins in integration tests
pnpm --filter @anvesx/connectors mutate # Stryker, break below 80
```

`vitest.config.ts` and `stryker.config.json` live in this root, shared by every package, so a package root
stays at five files (the structure lint counts config files). The Stryker `configFile` path has four `..`
segments because Stryker runs vitest from its sandbox, two folders below the package.

Commits follow Conventional Commits, with body lines of at most 100 columns. Hooks run through lefthook and must not
be bypassed.
