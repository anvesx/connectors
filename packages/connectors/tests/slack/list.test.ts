import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Replay } from "../support/replay.js";
import { slackFor, startSlack } from "./server.js";

let replay: Replay;
let slack: ReturnType<typeof slackFor>;
beforeAll(async () => {
  replay = await startSlack();
  slack = slackFor(replay);
});
afterAll(() => replay.close());

describe("slack list over @slack/web-api", () => {
  it("declares that it enforces the user token", () => expect(slack.enforcesUserToken).toBe(true));

  it("pages channels in the company zone with workspace and channel groups as the ACL", async () => {
    const first = await slack.list({ limit: 2 });
    expect(first.items.map((d) => d.address)).toEqual(["C01GEN", "G02LEAD"]);
    expect(first.items[0]).toMatchObject({
      title: "#general",
      version: "1761900000000",
      zone: "company",
      acl: { allowUsers: [], allowGroups: ["slack:workspace"] },
    });
    expect(first.items[0]?.updatedAt).toBe("2025-10-31T08:40:00.000Z");
    expect(first.items[1]?.acl.allowGroups).toEqual(["slack:channel:G02LEAD"]);
    expect(first.nextCursor).toBe("dGVhbTpDMDNSRU1PVEU=");
    const second = await slack.list({ limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((d) => d.address)).toEqual(["C03OPEN"]);
    expect(second.nextCursor).toBeUndefined();
  });

  it("sends the index token and the channel types it indexes", async () => {
    const hit = replay.seen.find((r) => r.path.startsWith("/conversations.list"));
    expect(hit?.authorization).toBe("Bearer xoxp-index");
    expect(new URL(`http://x${hit?.path}`).searchParams.get("types")).toBe("public_channel,private_channel");
  });

  it("rejects a bad cursor and an out-of-range limit", async () => {
    await expect(slack.list({ limit: 5, cursor: "bad" })).rejects.toMatchObject({ code: "BAD_CURSOR" });
    await expect(slack.list({ limit: 0 })).rejects.toThrow(RangeError);
    await expect(slack.list({ limit: 1001 })).rejects.toThrow(RangeError);
  });
});
