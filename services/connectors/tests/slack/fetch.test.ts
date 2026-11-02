import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Replay } from "../../src/testing/replay.js";
import { slackFor, startSlack } from "./server.js";

let replay: Replay;
let slack: ReturnType<typeof slackFor>;
beforeAll(async () => {
  replay = await startSlack();
  slack = slackFor(replay);
});
afterAll(() => replay.close());

describe("slack fetch and canRead with the asker's own token", () => {
  it("renders history oldest first and versions it by the newest message", async () => {
    const got = await slack.fetch("C01GEN", { token: "xoxp-alice" });
    expect(got).toEqual({
      text: "U01ALICE: Welcome to the channel\nB01: Deploy finished\nU02BOB: Expenses are due Friday.\n",
      version: "1761999999.000200",
    });
    expect(replay.seen.at(-1)?.authorization).toBe("Bearer xoxp-alice");
  });

  it("maps channel_not_found to NOT_FOUND and not_in_channel to FORBIDDEN", async () => {
    await expect(slack.fetch("CNOPE", { token: "t" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(slack.fetch("G02LEAD", { token: "t" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("canRead is true on ok, false when Slack hides the channel", async () => {
    expect(await slack.canRead?.("C01GEN", { token: "xoxp-alice" })).toBe(true);
    expect(replay.seen.at(-1)?.authorization).toBe("Bearer xoxp-alice");
    expect(await slack.canRead?.("G02LEAD", { token: "xoxp-bob" })).toBe(false);
    expect(await slack.canRead?.("CNOPE", { token: "xoxp-bob" })).toBe(false);
  });

  it("canRead throws on a server error instead of guessing", async () => {
    await expect(slack.canRead?.("CBOOM", { token: "t" })).rejects.toThrow();
  });
});
