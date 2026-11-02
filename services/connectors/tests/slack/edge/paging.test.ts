import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Replay } from "../../../src/testing/replay.js";
import { calls, reply, slackAt, start } from "./helper.js";

let replay: Replay;
const next = (c: string) => ({ response_metadata: { next_cursor: c } });
beforeAll(async () => {
  replay = await start({
    "/users.list": (u) =>
      u.searchParams.get("cursor")
        ? reply({ members: [{ id: "U2" }, { id: "UB", is_bot: true }, { id: "UD", deleted: true }, { id: "USLACKBOT" }, { name: "noid" }], ...next("") })
        : reply({ members: [{ id: "U1" }], ...next("u2") }),
    "/conversations.list": (u) =>
      u.searchParams.get("cursor") ? reply({ channels: [{ id: "G2" }] }) : reply({ channels: [{ id: "G1" }, { name: "noid" }], ...next("c2") }),
    "/conversations.members": (u) => {
      if (u.searchParams.get("channel") === "G2") return reply({});
      return u.searchParams.get("cursor") ? reply({ members: ["U2"] }) : reply({ members: ["U1"], ...next("m2") });
    },
  });
});
afterAll(() => replay.close());

describe("slack listMemberships paging", () => {
  it("follows every cursor, skips bots, deleted users and channels without an id, and tolerates a page with no members", async () => {
    const pairs = await slackAt(replay).listMemberships?.();
    expect(pairs).toEqual([
      { group: "slack:workspace", user: "U1" },
      { group: "slack:workspace", user: "U2" },
      { group: "slack:channel:G1", user: "U1" },
      { group: "slack:channel:G1", user: "U2" },
    ]);
  });
  it("sends the cursor only once there is one, with the page size and the archived filter", () => {
    expect(calls(replay, "/users.list")).toEqual([{ limit: "200" }, { limit: "200", cursor: "u2" }]);
    expect(calls(replay, "/conversations.list")).toEqual([
      { types: "private_channel", exclude_archived: "true", limit: "200" },
      { types: "private_channel", exclude_archived: "true", limit: "200", cursor: "c2" },
    ]);
    expect(calls(replay, "/conversations.members")).toEqual([
      { channel: "G1", limit: "200" },
      { channel: "G1", limit: "200", cursor: "m2" },
      { channel: "G2", limit: "200" },
    ]);
  });
});
