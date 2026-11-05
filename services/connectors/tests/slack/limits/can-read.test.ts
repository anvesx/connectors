import { afterEach, describe, expect, it } from "vitest";
import { createSlackConnector, UpstreamLimitError } from "../../../src/index.js";
import { type Replay, startReplay } from "../../../src/testing/replay.js";

let replay: Replay;
afterEach(() => replay.close());

describe("slack canRead under a rate limit", () => {
  it("raises RATE_LIMITED, not the SDK platform error, when every call is a 429", async () => {
    replay = await startReplay({ "/conversations.info": { status: 429, headers: { "retry-after": "0" }, body: { ok: false, error: "ratelimited" } } });
    const slack = createSlackConnector({ id: "sl", listToken: "x", baseUrl: `${replay.url}/`, retries: 0 });
    const error = await slack.canRead?.("C1", { token: "u" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamLimitError);
    expect((error as UpstreamLimitError).code).toBe("RATE_LIMITED");
    expect(replay.seen.length).toBe(1);
  });
});
