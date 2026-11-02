import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { slackManifest } from "../../src/index.js";
import type { Replay } from "../support/replay.js";
import { calls, fail, reply, slackAt, start } from "./helper.js";

let replay: Replay;
beforeAll(async () => {
  replay = await start({
    "/conversations.list": (u) => (u.searchParams.get("cursor") === "scope" ? fail("missing_scope") : reply({ channels: [{ id: "C1" }, { name: "noid" }] })),
    "/conversations.history": (u) => {
      const c = u.searchParams.get("channel");
      if (c === "CGONE") return fail("channel_not_found");
      if (c === "CLOCK") return fail("access_denied");
      if (c === "CEMPTY") return reply({ messages: [] });
      if (c === "CNONE") return reply({});
      return reply({ messages: [{ ts: "9.1" }, { bot_id: "B1", text: "hi", ts: "9.0" }, { user: "U1", ts: "8.0" }] });
    },
    "/users.list": () => fail("token_revoked"),
  });
});
afterAll(() => replay.close());
const ctx = { token: "xoxp-u" };

describe("slack connector edges", () => {
  it("accepts the limit bounds 1 and 1000 and names the range when rejecting others", async () => {
    const slack = slackAt(replay);
    await expect(slack.list({ limit: 1 })).resolves.toMatchObject({ items: [{ address: "C1" }] });
    await expect(slack.list({ limit: 1000 })).resolves.toMatchObject({ items: [{ address: "C1" }] });
    await expect(slack.list({ limit: 1001 })).rejects.toThrow("limit must be an integer from 1 to 1000");
    await expect(slack.list({ limit: 0 })).rejects.toThrow("limit must be an integer from 1 to 1000");
  });
  it("lists without archived channels, returns no nextCursor key on the last page, and names the failing call", async () => {
    const slack = slackAt(replay);
    expect(await slack.list({ limit: 7 })).not.toHaveProperty("nextCursor");
    expect(calls(replay, "/conversations.list").at(-1)).toEqual({ types: "public_channel,private_channel", exclude_archived: "true", limit: "7" });
    await expect(slack.list({ limit: 7, cursor: "scope" })).rejects.toMatchObject({ code: "FORBIDDEN", message: "Forbidden: list" });
    await expect(slack.listMemberships?.()).rejects.toMatchObject({ code: "FORBIDDEN", message: "Forbidden: memberships" });
    await expect(slack.changes?.({ token: "t", cursor: "scope" })).rejects.toThrow();
  });
  it("labels history as oldest-first author lines, with bot and unknown authors and empty text", async () => {
    const doc = await slackAt(replay).fetch("C1", ctx);
    expect(doc).toEqual({ text: "U1: \nB1: hi\nunknown: \n", version: "9.1" });
    expect(await slackAt(replay).fetch("CEMPTY", ctx)).toEqual({ text: "", version: "0" });
    expect(await slackAt(replay).fetch("CNONE", ctx)).toEqual({ text: "", version: "0" });
  });
  it("names the address in not-found and forbidden errors", async () => {
    await expect(slackAt(replay).fetch("CGONE", ctx)).rejects.toMatchObject({ code: "NOT_FOUND", message: "Not found: CGONE" });
    await expect(slackAt(replay).fetch("CLOCK", ctx)).rejects.toMatchObject({ code: "FORBIDDEN", message: "Forbidden: CLOCK" });
  });
  it("loads from the manifest against another host, in the company zone", async () => {
    const c = slackManifest.load({ id: "sl:1", listToken: "xoxp-m", baseUrl: `${replay.url}/` });
    expect((await c.list({ limit: 3 })).items[0]).toMatchObject({ address: "C1", zone: "company" });
    expect(replay.seen.at(-1)?.authorization).toBe("Bearer xoxp-m");
  });
});
