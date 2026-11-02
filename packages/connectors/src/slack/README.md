# slack

- `connector.ts` `createSlackConnector`: `list`, `fetch`, `canRead`, `listMemberships`, `changes` over `@slack/web-api`
- `map.ts` channel to document, history to text, Slack error codes to connector errors, cursor paging
- `members.ts` `listSlackMembers`: `slack:workspace` pairs for active humans, `slack:channel:<id>` pairs for private channels
- `changes.ts` cursor is a message timestamp; one `upsert` per joined channel with newer messages
- `manifest.ts` the Slack catalog entry (`slackManifest`): OAuth v2, company zone

One channel is one document; its text is the last 200 messages, oldest first. A user token is needed (`xoxp`): a bot token only sees channels the bot joined.
