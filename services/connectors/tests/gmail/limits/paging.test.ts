import { afterEach, describe, expect, it } from "vitest";
import { createGmailConnector } from "../../../src/index.js";
import { type Replay, startReplay } from "../../../src/testing/replay.js";

let replay: Replay;
afterEach(() => replay.close());

/** History page `pN` holds message `mN` and points at `p(N+1)` until `lastPage`; the first page has no token. */
const start = async (lastPage?: number) => {
  replay = await startReplay({
    "/gmail/v1/users/me/history": (url) => {
      const n = Number((url.searchParams.get("pageToken") ?? "p1").slice(1));
      const page = { history: [{ id: String(4000 + n), messagesAdded: [{ message: { id: `m${n}` } }] }], historyId: "9000" };
      return { status: 200, body: n === lastPage ? page : { ...page, nextPageToken: `p${n + 1}` } };
    },
  });
  return (maxPages?: number) => createGmailConnector({ id: "gm", listToken: "t", rootUrl: replay.url, ...(maxPages !== undefined && { maxPages }) });
};
const addresses = (set: { events: { address: string }[] }) => set.events.map((e) => e.address);

describe("gmail changes paging cap", () => {
  it("stops at maxPages and hands back a cursor that resumes with the next page token", async () => {
    const gmail = (await start())(3);
    const first = await gmail.changes({ token: "t", cursor: "4000" });
    expect(addresses(first)).toEqual(["m1", "m2", "m3"]);
    expect(first.next).toBe("4000:p4");
    expect(replay.seen).toHaveLength(3);
    const second = await gmail.changes({ token: "t", cursor: first.next });
    expect(addresses(second)).toEqual(["m4", "m5", "m6"]);
    expect(second.next).toBe("4000:p7");
    expect(replay.seen.at(-3)?.path).toContain("startHistoryId=4000");
    expect(replay.seen.at(-3)?.path).toContain("pageToken=p4");
  });

  it("reads every page and returns the mailbox history id when the last page arrives within maxPages", async () => {
    const set = await (await start(3))(3).changes({ token: "t", cursor: "4000" });
    expect(addresses(set)).toEqual(["m1", "m2", "m3"]);
    expect(set.next).toBe("9000");
  });

  it("finishes a resumed walk with a plain history id", async () => {
    const set = await (await start(5))(3).changes({ token: "t", cursor: "4000:p4" });
    expect(addresses(set)).toEqual(["m4", "m5"]);
    expect(set.next).toBe("9000");
  });

  it("defaults to 50 pages of 500 history records", async () => {
    const set = await (await start())().changes({ token: "t", cursor: "4000" });
    expect(set.events).toHaveLength(50);
    expect(replay.seen).toHaveLength(50);
    expect(replay.seen[0]?.path).toContain("maxResults=500");
  });

  it("rejects a malformed cursor", async () => {
    await expect((await start())(3).changes({ token: "t", cursor: "abc:p1" })).rejects.toMatchObject({ code: "BAD_CURSOR" });
    await expect(createGmailConnector({ id: "gm", listToken: "t", rootUrl: replay.url }).changes({ token: "t", cursor: "4000:" })).rejects.toMatchObject({
      code: "BAD_CURSOR",
    });
  });
});
