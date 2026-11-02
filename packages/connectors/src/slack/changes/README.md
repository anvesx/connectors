# changes

- `changes.ts` `changesSince`: the cursor is a message timestamp; joined channels with newer messages give one `upsert` each; a missing cursor returns a baseline

Tests are in `tests/`.
