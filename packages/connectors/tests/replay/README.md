# replay

Runs each adapter end to end, through the real vendor SDK and a real socket, against fixture responses served by
`support/replay.ts`. This checks request shapes, token headers, paging and error mapping. It is not a live test.
