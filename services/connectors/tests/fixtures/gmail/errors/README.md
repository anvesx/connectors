# gmail error fixtures

Google error envelopes (`error.code`, `message`, `status`) that the adapter maps to connector errors.

- `bad-request.json` 400 `INVALID_ARGUMENT`, an invalid page token
- `forbidden.json` 403 `PERMISSION_DENIED`, insufficient scopes
- `not-found.json` 404 `NOT_FOUND`, which for the change feed means the history cursor expired
