# drive error fixtures

- `error-403.json` the Drive error body for "The user does not have sufficient permissions for this file."

`canRead` answers false on a 403 or 404 and throws on any other status, so this body proves the false branch against the real client.
