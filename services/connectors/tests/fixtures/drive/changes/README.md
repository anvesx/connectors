# drive change fixtures

What the Drive changes API returns when the adapter builds its change feed.

- `start-token.json` a `drive#startPageToken` (`14400`): the baseline cursor returned the first time `changes` is called
- `changes-list.json` a `drive#changeList` with `newStartPageToken` `14502` and three changes: a live file, a removed file and a trashed file
