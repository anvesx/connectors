import { afterEach, describe, expect, it } from "vitest";
import { boot } from "./seed.js";

let h: Awaited<ReturnType<typeof boot>>;
afterEach(() => h.server.close());

describe("drive changes cursor", () => {
  it("baselines at the start token, then returns only what happened since, across pages", async () => {
    h = await boot({ cap: 2 });
    const base = await h.drive.changes({ token: "t" });
    expect(base).toEqual({ events: [], next: "0" });
    h.server.changes.push(
      { fileId: "doc1", removed: false },
      { fileId: "txt1", removed: true },
      { fileId: "txt2", removed: false, trashed: true },
      { fileId: "txt3", removed: false },
    );
    const since = await h.drive.changes({ token: "t", cursor: base.next });
    expect(since.events).toEqual([
      { address: "doc1", kind: "upsert" },
      { address: "txt1", kind: "delete" },
      { address: "txt2", kind: "delete" },
      { address: "txt3", kind: "upsert" },
    ]);
    expect(since.next).toBe("4");
    expect(h.server.seen.filter((r) => r.path.startsWith("/drive/v3/changes?")).length).toBe(2);
  });

  it("returns nothing new from the cursor it just gave", async () => {
    h = await boot();
    h.server.changes.push({ fileId: "doc1", removed: false });
    const first = await h.drive.changes({ token: "t", cursor: "0" });
    expect(await h.drive.changes({ token: "t", cursor: first.next })).toEqual({ events: [], next: first.next });
  });

  it("maps a malformed cursor to BAD_CURSOR and a rejected token to FORBIDDEN", async () => {
    h = await boot({ tokens: ["good"] });
    await expect(h.drive.changes({ token: "good", cursor: "bad" })).rejects.toMatchObject({ code: "BAD_CURSOR" });
    await expect(h.drive.changes({ token: "revoked" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
