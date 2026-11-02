import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Replay } from "../support/replay.js";
import { calls, reply, slackAt, start } from "./helper.js";

const NEWS: Record<string, string | undefined> = { C1: "1762000200.000100", C2: "1762000100.000100", C3: undefined, C4: "1762000000.0" };
let replay: Replay;
beforeAll(async () => {
  replay = await start({
    "/conversations.list": () =>
      reply({ channels: [{ id: "C1" }, { id: "C2" }, { id: "C3" }, { id: "C4" }, { id: "C5", is_member: false }, { name: "noid" }] }),
    "/conversations.history": (u) => {
      const ts = NEWS[u.searchParams.get("channel") ?? ""];
      return reply(ts ? { messages: [{ ts }] } : {});
    },
  });
});
afterAll(() => replay.close());

describe("slack changes edge cases", () => {
  it("keeps the newest timestamp across channels, even when later channels are older", async () => {
    const set = await slackAt(replay).changes?.({ token: "xoxp-u", cursor: "1762000000.000000" });
    expect(set).toEqual({
      events: [
        { address: "C1", kind: "upsert" },
        { address: "C2", kind: "upsert" },
        { address: "C4", kind: "upsert" },
      ],
      next: "1762000200.000100",
    });
  });
  it("asks for one message newer than the cursor, only in channels it has joined, without archived ones", () => {
    expect(calls(replay, "/conversations.list")[0]).toMatchObject({ exclude_archived: "true", limit: "200" });
    expect(calls(replay, "/conversations.history").map((c) => c.channel)).toEqual(["C1", "C2", "C3", "C4"]);
    expect(calls(replay, "/conversations.history")[0]).toEqual({ channel: "C1", oldest: "1762000000.000000", limit: "1" });
  });
  it("leaves the cursor alone when a message has the same time written differently", async () => {
    const same = await start({
      "/conversations.list": () => reply({ channels: [{ id: "C4" }] }),
      "/conversations.history": () => reply({ messages: [{ ts: "1762000000.0" }] }),
    });
    const set = await slackAt(same).changes?.({ token: "t", cursor: "1762000000.000000" });
    expect(set?.next).toBe("1762000000.000000");
    await same.close();
  });
});
