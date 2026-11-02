import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Replay } from "../../../shared/tests/replay.js";
import { calls, gmailAt, ok, start, status, U } from "./helper.js";

let replay: Replay;
beforeAll(async () => {
  replay = await start({
    [`${U}/profile`]: ok({}),
    [`${U}/history`]: (u) => {
      const s = u.searchParams.get("startHistoryId");
      if (s === "404") return status(404);
      if (s === "500") return status(500);
      if (s === "401") return status(401);
      if (s === "10") return ok({});
      return ok({
        history: [
          { messagesAdded: [{ message: { id: "a" } }, {}, { message: {} }], messagesDeleted: [{ message: { id: "b" } }, {}, { message: {} }] },
          { messagesAdded: [{ message: { id: "b" } }], messagesDeleted: [{ message: { id: "a" } }] },
        ],
        historyId: "99",
      });
    },
  });
});
afterAll(() => replay.close());
const at = (cursor?: string) => gmailAt(replay).changes?.({ token: "t", ...(cursor && { cursor }) });

describe("gmail changes edges", () => {
  it("baselines to an empty cursor when the profile has no history id", async () => {
    expect(await at()).toEqual({ events: [], next: "" });
  });
  it("rejects cursors that are not wholly digits", async () => {
    for (const bad of ["a12", "12a", "1.5", "-1"]) await expect(at(bad)).rejects.toMatchObject({ code: "BAD_CURSOR" });
  });
  it("keeps the cursor and reports no events when history is empty", async () => {
    expect(await at("10")).toEqual({ events: [], next: "10" });
    expect(calls(replay, `${U}/history`).at(-1)).toEqual({ startHistoryId: "10" });
  });
  it("lets the last event for a message win and skips records without ids", async () => {
    expect(await at("5")).toEqual({
      events: [
        { address: "a", kind: "delete" },
        { address: "b", kind: "upsert" },
      ],
      next: "99",
    });
  });
  it("maps 404 to a bad cursor, but passes other failures on under the call's name", async () => {
    await expect(at("404")).rejects.toMatchObject({ code: "BAD_CURSOR" });
    await expect(at("500")).rejects.not.toMatchObject({ code: "BAD_CURSOR" });
    await expect(at("401")).rejects.toMatchObject({ code: "FORBIDDEN", message: "Forbidden: changes" });
  });
});
