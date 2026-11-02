import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Replay } from "../support/replay.js";
import { slackFor, startSlack } from "./server.js";

let replay: Replay;
let slack: ReturnType<typeof slackFor>;
beforeAll(async () => {
  replay = await startSlack();
  slack = slackFor(replay, () => 1762000000_000);
});
afterAll(() => replay.close());

describe("slack changes", () => {
  it("without a cursor returns the clock as a baseline and no events", async () => {
    expect(await slack.changes({ token: "t" })).toEqual({ events: [], next: "1762000000.000000" });
  });

  it("reports channels with messages after the cursor and advances to the newest", async () => {
    const since = await slack.changes({ token: "alice", cursor: "1761999999.000200" });
    expect(since).toEqual({ events: [{ address: "C01GEN", kind: "upsert" }], next: "1762000500.000100" });
    expect(await slack.changes({ token: "alice", cursor: since.next })).toEqual({ events: [], next: since.next });
  });

  it("skips channels the token is not a member of", async () => {
    replay.seen.length = 0;
    await slack.changes({ token: "alice", cursor: "1761999999.000200" });
    const history = replay.seen.filter((r) => r.path.startsWith("/conversations.history"));
    expect(history.map((r) => new URL(`http://x${r.path}`).searchParams.get("channel"))).toEqual(["C01GEN", "G02LEAD"]);
    expect(replay.seen.at(-1)?.authorization).toBe("Bearer alice");
  });

  it("rejects a cursor that is not a Slack timestamp", async () => {
    await expect(slack.changes({ token: "t", cursor: "yesterday" })).rejects.toMatchObject({ code: "BAD_CURSOR" });
  });
});
