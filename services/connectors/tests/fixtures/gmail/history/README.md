# gmail history fixtures

`history.list` replies for the change feed, which uses the history id as its cursor.

- `list.json` two `messagesAdded` records (`m4`, `m5`), the first page of changes
- `list-second.json` a `messagesDeleted` record for `m5`, the page after the first
- `empty.json` no changes, only the current history id `5000`
