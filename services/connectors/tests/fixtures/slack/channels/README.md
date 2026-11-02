# slack channel fixtures

- `first.json` first `conversations.list` page: `#general` (public, joined) and `#leadership` (private group, joined), with a `next_cursor`
- `second.json` last page: `#random`, a public channel the caller has not joined (`is_member: false`), with an empty cursor
- `private.json` a page holding only `#leadership` (`is_group`, `is_private`), used when private channels are requested
- `info.json` a `conversations.info` reply for `#general`, used by `canRead`
