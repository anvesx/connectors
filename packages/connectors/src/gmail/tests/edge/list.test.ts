import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Replay } from "../../../shared/tests/replay.js";
import { calls, gmailAt, ok, start, status, U } from "./helper.js";

let replay: Replay;
beforeAll(async () => {
  replay = await start({
    [`${U}/profile`]: (u) => (u.searchParams.get("fail") ? status(404) : ok({ emailAddress: "me@x.io" })),
    [`${U}/messages`]: (u) => {
      const t = u.searchParams.get("pageToken");
      if (t === "bad") return status(400);
      if (t === "locked") return status(403);
      return t === "empty" ? ok({}) : ok({ messages: [{ id: "m1" }, {}], nextPageToken: "n2" });
    },
    [`${U}/messages/m1`]: ok({ id: "m1", historyId: "7", internalDate: "1000", payload: { headers: [{ name: "SUBJECT", value: "Hi" }] } }),
  });
});
afterAll(() => replay.close());

describe("gmail list edges", () => {
  it("accepts limits 1 and 500 and states the range for 0, 501 and fractions", async () => {
    const gmail = gmailAt(replay);
    await expect(gmail.list({ limit: 1 })).resolves.toMatchObject({ items: [{ address: "m1" }] });
    await expect(gmail.list({ limit: 500 })).resolves.toMatchObject({ items: [{ address: "m1" }] });
    for (const limit of [0, 501, 1.5]) await expect(gmail.list({ limit })).rejects.toThrow("limit must be an integer from 1 to 500");
  });
  it("sends the page size and token, asks for the Subject header only, and skips messages without an id", async () => {
    const page = await gmailAt(replay).list({ limit: 9, cursor: "p1" });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ title: "Hi", version: "7", acl: { allowUsers: ["me@x.io"] } });
    expect(calls(replay, `${U}/messages`).at(-1)).toEqual({ maxResults: "9", pageToken: "p1" });
    expect(calls(replay, `${U}/messages/m1`).at(-1)).toEqual({ format: "metadata", metadataHeaders: "Subject" });
    expect(calls(replay, `${U}/messages`).at(-2)).toEqual({ maxResults: "500" });
  });
  it("returns an empty page and no cursor when the mailbox has no messages", async () => {
    expect(await gmailAt(replay).list({ limit: 2, cursor: "empty" })).toEqual({ items: [] });
  });
  it("treats 400 as a bad cursor only when a cursor was sent, and names the failing call otherwise", async () => {
    await expect(gmailAt(replay).list({ limit: 2, cursor: "bad" })).rejects.toMatchObject({ code: "BAD_CURSOR" });
    await expect(gmailAt(replay).list({ limit: 2, cursor: "locked" })).rejects.toMatchObject({ code: "FORBIDDEN", message: "Forbidden: list" });
  });
});
