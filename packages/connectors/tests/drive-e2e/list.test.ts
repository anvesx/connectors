import { afterEach, describe, expect, it } from "vitest";
import { boot } from "./seed.js";

let h: Awaited<ReturnType<typeof boot>>;
afterEach(() => h.server.close());

describe("drive list over the real googleapis client", () => {
  it("pages through every text file and Google Doc by the server's page token", async () => {
    h = await boot({ cap: 1 });
    const addresses: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await h.drive.list({ limit: 1000, ...(cursor && { cursor }) });
      addresses.push(...page.items.map((d) => d.address));
      cursor = page.nextCursor;
      pages++;
    } while (cursor);
    expect(pages).toBe(4);
    expect(addresses).toEqual(["doc1", "txt1", "txt2", "txt3"]);
    const q = new URL(`http://x${h.server.seen[0]?.path}`).searchParams;
    expect(q.get("q")).toContain("trashed = false");
    expect(q.get("supportsAllDrives")).toBe("true");
  });

  it("maps grants to the ACL and sends the index token", async () => {
    h = await boot();
    const { items } = await h.drive.list({ limit: 1 });
    expect(items[0]).toMatchObject({
      address: "doc1",
      title: "Leave policy",
      version: "42",
      acl: { allowUsers: ["alice@acme.test"], allowGroups: ["domain:acme.test"] },
    });
    expect(h.server.seen.every((r) => r.authorization === "Bearer index")).toBe(true);
  });

  it("hides files the index token cannot see, and rejects a bad cursor", async () => {
    h = await boot();
    const seen = await h.drive.list({ limit: 1000 });
    expect(seen.items.map((d) => d.address)).not.toContain("doc2");
    await expect(h.drive.list({ limit: 1, cursor: "bad" })).rejects.toMatchObject({ code: "BAD_CURSOR" });
  });

  it("requires a token: with none the client sends no request, and the server itself answers 401", async () => {
    h = await boot({}, "");
    expect(h.drive.enforcesUserToken).toBe(true);
    await expect(h.drive.list({ limit: 1 })).rejects.toThrow();
    expect(h.server.seen).toEqual([]);
    expect((await fetch(`${h.server.url}/drive/v3/files`)).status).toBe(401);
  });

  it("refuses a token the server does not know", async () => {
    h = await boot({ tokens: ["good"] });
    await expect(h.drive.list({ limit: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
