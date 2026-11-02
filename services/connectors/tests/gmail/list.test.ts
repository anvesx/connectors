import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Replay } from "../../src/testing/replay.js";
import { gmailFor, startGmail } from "./server.js";

let replay: Replay;
let gmail: ReturnType<typeof gmailFor>;
beforeAll(async () => {
  replay = await startGmail();
  gmail = gmailFor(replay);
});
afterAll(() => replay.close());

describe("gmail list over googleapis", () => {
  it("declares that it enforces the user token", () => expect(gmail.enforcesUserToken).toBe(true));

  it("pages messages into the personal zone, readable only by the mailbox owner", async () => {
    const first = await gmail.list({ limit: 2 });
    expect(first.items.map((d) => d.address)).toEqual(["m1", "m2"]);
    expect(first.items[0]).toMatchObject({
      title: "Expense policy",
      version: "4100",
      zone: "personal",
      acl: { allowUsers: ["alice@acme.test"], allowGroups: [] },
    });
    expect(first.items[0]?.updatedAt).toBe("2025-10-31T08:40:00.000Z");
    expect(first.nextCursor).toBe("tok2");
    const second = await gmail.list({ limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((d) => [d.address, d.title])).toEqual([["m3", "(no subject)"]]);
    expect(second.nextCursor).toBeUndefined();
  });

  it("sends the index token and asks for metadata only", () => {
    expect(replay.seen.every((r) => r.authorization === "Bearer ya29-index")).toBe(true);
    const gets = replay.seen.filter((r) => /messages\/m\d/.test(r.path));
    expect(gets.every((r) => new URL(`http://x${r.path}`).searchParams.get("format") === "metadata")).toBe(true);
  });

  it("rejects a bad cursor and an out-of-range limit", async () => {
    await expect(gmail.list({ limit: 5, cursor: "bad" })).rejects.toMatchObject({ code: "BAD_CURSOR" });
    await expect(gmail.list({ limit: 0 })).rejects.toThrow(RangeError);
    await expect(gmail.list({ limit: 501 })).rejects.toThrow(RangeError);
  });
});
