# tests

Everything that verifies the package lives here, beside `src/`, in folders that mirror it: `catalog/`, `drive/`, `github/`, `gmail/`, `shared/` and `slack/` (with `changes/` and `members/` under the adapters that have them).

- `fixtures/` recorded-shape JSON replies the replay servers answer with
- The replay and Drive server helpers that the package exports live in `src/testing/`

Tests run the real vendor SDKs against local HTTP servers, never mocks. Live API tests (`live.test.ts`) skip themselves unless their token variables are set (see the package README).
