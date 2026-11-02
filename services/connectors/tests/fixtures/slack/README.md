# slack fixtures

Slack Web API replies, grouped by the part of the API they answer. Slack answers every call with HTTP 200 and an
`ok` flag; a failure is `ok: false` with an `error` code, so even the error fixtures are 200 replies.

- `channels/` `conversations.list` pages, a private-channel page and `conversations.info`
- `history/` `conversations.history` pages
- `people/` `users.list` and `conversations.members`
- `errors/` `ok: false` bodies the adapter must map to connector errors
