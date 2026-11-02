# gmail

- `connector.ts` `createGmailConnector`: `list`, `fetch`, `canRead`, `changes` over `@googleapis/gmail`
- `map.ts` pure mapping from messages (title, ACL, text) and history records
- `changes.ts` profile history id as baseline, `history.list` paging; 404 means the cursor expired
- `manifest.ts` the Gmail catalog entry (`gmailManifest`): shared `google` OAuth client, `gmail.readonly`, personal zone

Each message is a document readable only by the mailbox owner. There is no `listMemberships`: a mailbox has no groups.
