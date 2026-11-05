import { afterEach, describe, expect, it } from "vitest";
import { createDriveConnector } from "../../../src/index.js";
import { type Replay, startReplay } from "../../../src/testing/replay.js";

let replay: Replay;
afterEach(() => replay.close());

/** Page `tN` holds one change and points at `t(N+1)` until `lastPage`; there is no last page when it is undefined. */
const start = async (lastPage?: number) => {
  replay = await startReplay({
    "/drive/v3/changes": (url) => {
      const n = Number((url.searchParams.get("pageToken") ?? "t1").slice(1));
      const page = { changes: [{ fileId: `f${n}`, removed: false, file: { trashed: false } }] };
      return { status: 200, body: n === lastPage ? { ...page, newStartPageToken: "done" } : { ...page, nextPageToken: `t${n + 1}` } };
    },
  });
  return (maxPages: number) => createDriveConnector({ id: "gd", listToken: "t", rootUrl: replay.url, maxPages });
};
const pagesRead = () => replay.seen.length;

describe("drive changes paging cap", () => {
  it("stops at maxPages and hands back the next page token to resume from", async () => {
    const drive = (await start())(3);
    const first = await drive.changes({ token: "t", cursor: "t1" });
    expect(first.events.map((e) => e.address)).toEqual(["f1", "f2", "f3"]);
    expect(first.next).toBe("t4");
    expect(pagesRead()).toBe(3);
    // Resuming from `next` continues where it stopped, with nothing repeated or lost.
    const second = await drive.changes({ token: "t", cursor: first.next });
    expect(second.events.map((e) => e.address)).toEqual(["f4", "f5", "f6"]);
    expect(second.next).toBe("t7");
  });

  it("reads every page and returns Drive's new start token when the last page arrives within maxPages", async () => {
    const drive = (await start(3))(3);
    const set = await drive.changes({ token: "t", cursor: "t1" });
    expect(set.events).toHaveLength(3);
    expect(set.next).toBe("done");
  });
});
