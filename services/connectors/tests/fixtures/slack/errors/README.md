# slack error fixtures

Each file is a Slack `ok: false` body, returned with HTTP 200 as in production.

- `channel-not-found.json` `channel_not_found`, which the adapter maps to `NOT_FOUND` (and `canRead` to false)
- `not-in-channel.json` `not_in_channel`, which the adapter maps to `FORBIDDEN` (and `canRead` to false)
- `invalid-cursor.json` `invalid_cursor`, which the adapter raises as a bad cursor
