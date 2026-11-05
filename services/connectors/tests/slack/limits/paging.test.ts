import { afterEach, describe, expect, it } from "vitest";
import { createSlackConnector } from "../../../src/index.js";
import { type Replay, startReplay } from "../../../src/testing/replay.js";

let replay: Replay;
afterEach(() => replay.close());

const connector = (maxPages: number) => createSlackConnector({ id: "sl", listToken: "x", baseUrl: `${replay.url}/`, retries: 0, maxPages });
const at = (path: string) => replay.seen.filter((r) => r.path.startsWith(path)).length;

describe("slack paging caps", () => {
  it("stops listing members at maxPages and raises PAGE_LIMIT when users.list never ends", async () => {
    replay = await startReplay({ "/users.list": { status: 200, body: { ok: true, members: [{ id: "U1" }], response_metadata: { next_cursor: "more" } } } });
    await expect(connector(3).listMemberships?.()).rejects.toMatchObject({ code: "PAGE_LIMIT" });
    expect(at("/users.list")).toBe(3);
  });

  it("stops the changes channel walk at maxPages and raises PAGE_LIMIT", async () => {
    replay = await startReplay({ "/conversations.list": { status: 200, body: { ok: true, channels: [], response_metadata: { next_cursor: "more" } } } });
    await expect(connector(2).changes({ token: "x", cursor: "1762000000.000000" })).rejects.toMatchObject({ code: "PAGE_LIMIT" });
    expect(at("/conversations.list")).toBe(2);
  });

  it("returns everything when the last page arrives within maxPages", async () => {
    replay = await startReplay({
      "/users.list": (u) =>
        u.searchParams.get("cursor")
          ? { status: 200, body: { ok: true, members: [{ id: "U2" }] } }
          : { status: 200, body: { ok: true, members: [{ id: "U1" }], response_metadata: { next_cursor: "p2" } } },
      "/conversations.list": { status: 200, body: { ok: true, channels: [] } },
    });
    expect((await connector(2).listMemberships?.())?.map((m) => m.user)).toEqual(["U1", "U2"]);
  });
});
