# gmail fixtures

Gmail API v1 replies for the mailbox of `alice@acme.test`, in sub-folders by endpoint.

- `profile.json` `users.getProfile`: address, totals and the history id `5000` used as the change baseline
- `list/` `messages.list` pages
- `metadata/` messages fetched with `format=metadata` (headers only)
- `bodies/` messages fetched with `format=full`, including bodies
- `history/` `history.list` pages for the change feed
- `errors/` Google error bodies
