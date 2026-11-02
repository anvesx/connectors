import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Replay } from "../support/replay.js";
import { gmailFor, startGmail } from "./server.js";

let replay: Replay;
let gmail: ReturnType<typeof gmailFor>;
beforeAll(async () => {
  replay = await startGmail();
  gmail = gmailFor(replay);
});
afterAll(() => replay.close());

describe("gmail changes over the history feed", () => {
  it("without a cursor returns the mailbox history id as a baseline", async () => {
    expect(await gmail.changes({ token: "alice" })).toEqual({ events: [], next: "5000" });
    expect(replay.seen.at(-1)?.authorization).toBe("Bearer alice");
  });

  it("returns nothing when the cursor is current", async () => {
    expect(await gmail.changes({ token: "alice", cursor: "5000" })).toEqual({ events: [], next: "5000" });
  });

  it("follows history pages; the last event for a message wins", async () => {
    const since = await gmail.changes({ token: "alice", cursor: "4000" });
    expect(since.next).toBe("5000");
    expect(since.events).toEqual([
      { address: "m4", kind: "upsert" },
      { address: "m5", kind: "delete" },
      { address: "m1", kind: "delete" },
    ]);
  });

  it("treats an expired or malformed cursor as BAD_CURSOR", async () => {
    await expect(gmail.changes({ token: "t", cursor: "1" })).rejects.toMatchObject({ code: "BAD_CURSOR" });
    await expect(gmail.changes({ token: "t", cursor: "abc" })).rejects.toMatchObject({ code: "BAD_CURSOR" });
  });
});
