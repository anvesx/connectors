import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDriveConnector } from "../../src/index.js";
import { fixture, type Replay, startReplay } from "../support/replay.js";

const ID = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms";
const F = "/drive/v3/files";
let replay: Replay;
let drive: ReturnType<typeof createDriveConnector>;

beforeAll(async () => {
  replay = await startReplay({
    [F]: (url) => ({ status: url.searchParams.get("pageToken") === "bad" ? 400 : 200, body: fixture("drive/files-list") }),
    [`${F}/${ID}`]: { status: 200, body: fixture("drive/file-meta") },
    [`${F}/${ID}/export`]: { status: 200, body: "Leave policy text" },
    [`${F}/locked`]: { status: 403, body: fixture("drive/error-403") },
    [`${F}/gone`]: { status: 404, body: { error: { code: 404, message: "File not found: gone." } } },
    "/drive/v3/changes/startPageToken": { status: 200, body: fixture("drive/start-token") },
    "/drive/v3/changes": (url) => ({ status: url.searchParams.get("pageToken") === "bad" ? 400 : 200, body: fixture("drive/changes-list") }),
  });
  drive = createDriveConnector({ id: "gd", listToken: "index-token", rootUrl: replay.url });
});
afterAll(() => replay.close());

describe("drive connector over the vendor SDK", () => {
  it("declares that it enforces the user token", () => expect(drive.enforcesUserToken).toBe(true));

  it("lists documents with ACLs and passes the page token through as the cursor", async () => {
    const page = await drive.list({ limit: 2 });
    expect(page.items.map((d) => d.address)).toHaveLength(2);
    expect(page.items[0]!.acl.allowUsers).toEqual(["alice@acme.test", "bob@acme.test"]);
    expect(page.nextCursor).toBe("~!!~AI9FV7Q1x2");
    expect(replay.seen.at(-1)?.authorization).toBe("Bearer index-token");
    await expect(drive.list({ limit: 2, cursor: "bad" })).rejects.toMatchObject({ code: "BAD_CURSOR" });
  });

  it("exports a Google Doc as text with the caller's token and maps 404 and 403", async () => {
    expect(await drive.fetch(ID, { token: "alice-token" })).toEqual({ text: "Leave policy text", version: "42" });
    expect(replay.seen.at(-1)?.authorization).toBe("Bearer alice-token");
    await expect(drive.fetch("gone", { token: "t" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(drive.fetch("locked", { token: "t" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reports a baseline token, then changes since a cursor", async () => {
    expect(await drive.changes({ token: "t" })).toEqual({ events: [], next: "14400" });
    const since = await drive.changes({ token: "t", cursor: "14400" });
    expect(since.next).toBe("14502");
    expect(since.events.map((e) => e.kind)).toEqual(["upsert", "delete", "delete"]);
    await expect(drive.changes({ token: "t", cursor: "bad" })).rejects.toMatchObject({ code: "BAD_CURSOR" });
  });
});
