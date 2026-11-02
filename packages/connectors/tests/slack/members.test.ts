import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Replay } from "../support/replay.js";
import { slackFor, startSlack } from "./server.js";

let replay: Replay;
beforeAll(async () => {
  replay = await startSlack();
});
afterAll(() => replay.close());

describe("slack listMemberships", () => {
  it("pairs every active human with the workspace group and each private channel member with its channel group", async () => {
    const pairs = await slackFor(replay).listMemberships?.();
    expect(pairs).toEqual([
      { group: "slack:workspace", user: "U01ALICE" },
      { group: "slack:workspace", user: "U02BOB" },
      { group: "slack:channel:G02LEAD", user: "U01ALICE" },
      { group: "slack:channel:G02LEAD", user: "U02BOB" },
    ]);
    const members = replay.seen.filter((r) => r.path.startsWith("/conversations.members"));
    expect(members).toHaveLength(1);
    expect(members[0]?.authorization).toBe("Bearer xoxp-index");
  });
});
