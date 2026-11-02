# gmail metadata fixtures

Messages read with `format=metadata`; the adapter takes title and sender from the headers.

- `m1.json` "Expense policy" from `bob@acme.test`
- `m2.json` "Re: Expense policy" from `bob@acme.test`, same thread as `m1`
- `m3.json` a message in thread `t2` with an empty header list
