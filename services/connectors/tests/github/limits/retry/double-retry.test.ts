import { afterEach, describe, expect, it } from "vitest";
import { buildGithubConnector } from "../../../../src/github/connector.js";
import { UpstreamLimitError } from "../../../../src/index.js";
import { type Replay, type Reply, startReplay } from "../../../../src/testing/replay.js";

const FILE = "/repos/acme/handbook/contents/docs/guide.md";
let replay: Replay;
afterEach(() => replay.close());

const exhausted = (): Reply => ({
  status: 429,
  headers: { "retry-after": "2", "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 2) },
  body: { message: "API rate limit exceeded" },
});
const plain: Reply = { status: 429, headers: { "retry-after": "0" }, body: { message: "Too Many Requests" } };
// A 429 whose body carries `errors[].type: "RATE_LIMITED"`: the throttling plugin treats it as a primary limit, so `retryAfter429` must stay out.
const graphqlStyle: Reply = { status: 429, headers: { "retry-after": "0" }, body: { message: "limited", errors: [{ type: "RATE_LIMITED" }] } };
const attempt = async (reply: Reply | (() => Reply), maxRetries: number) => {
  replay = await startReplay({ [FILE]: reply });
  const github = buildGithubConnector({ id: "gh", owner: "acme", repo: "handbook", listToken: "t", baseUrl: replay.url, maxRetries }, { msPerSecond: 100 });
  return github.fetch("docs/guide.md", { token: "u" }).catch((e: unknown) => e);
};

describe("github 429 owned by the throttling plugin", () => {
  it("with x-ratelimit-remaining 0 and Retry-After makes maxRetries + 1 calls, not twice that", async () => {
    const error = await attempt(exhausted, 3);
    expect(error).toBeInstanceOf(UpstreamLimitError);
    expect((error as UpstreamLimitError).code).toBe("RATE_LIMITED");
    expect(replay.seen.length).toBe(4);
  });

  it("a plain 429 with only Retry-After still makes maxRetries + 1 calls", async () => {
    expect(await attempt(plain, 3)).toMatchObject({ code: "RATE_LIMITED" });
    expect(replay.seen.length).toBe(4);
  });

  it("a 429 whose body has errors[].type RATE_LIMITED, with Retry-After 0, makes maxRetries + 1 = 4 calls, not 8", async () => {
    // Throttling owns it (retries 3 times, 4 calls); if retryAfter429 also retried, each of its 4 rounds would repeat that.
    expect(await attempt(graphqlStyle, 3)).toMatchObject({ code: "RATE_LIMITED" });
    expect(replay.seen.length).toBe(4);
  });
});
