# gmail body fixtures

Messages read with `format=full`; the adapter extracts text from the payload.

- `m1-full.json` a `multipart/alternative` message with `text/plain` and `text/html` parts (base64url data)
- `m2-html-only.json` a single `text/html` payload with its body inline and no parts
- `minimal.json` a message with only `id`, `threadId` and `labelIds`, and no payload
