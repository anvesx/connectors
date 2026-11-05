import { afterEach, describe, expect, it } from "vitest";
import { createGmailConnector, UpstreamLimitError } from "../../../src/index.js";
import { type Replay, startReplay } from "../../../src/testing/replay.js";

const MESSAGE = "/gmail/v1/users/me/messages/m1";
let replay: Replay;
afterEach(() => replay.close());

const quota = {
  status: 403,
  body: { error: { code: 403, message: "Rate Limit Exceeded", errors: [{ domain: "usageLimits", reason: "userRateLimitExceeded" }] } },
};

describe("gmail canRead under a quota 403", () => {
  it("retries once, then raises RATE_LIMITED instead of answering false", async () => {
    replay = await startReplay({ [MESSAGE]: quota });
    const gmail = createGmailConnector({ id: "gm", listToken: "t", rootUrl: replay.url, retries: 1 });
    const error = await gmail.canRead?.("m1", { token: "u" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamLimitError);
    expect((error as UpstreamLimitError).code).toBe("RATE_LIMITED");
    expect(replay.seen.length).toBe(2);
  });
});
