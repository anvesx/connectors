import { afterEach, describe, expect, it } from "vitest";
import { buildGithubConnector } from "../../../src/github/connector.js";
import { UpstreamLimitError } from "../../../src/index.js";
import { fixture, type Replay, type Reply, startReplay } from "../../../src/testing/replay.js";

const FILE = "/repos/acme/handbook/contents/docs/guide.md";
const SECONDARY = { message: "You have exceeded a secondary rate limit. Please wait a few minutes before you try again." };
let replay: Replay;
afterEach(() => replay.close());

/** Answers `first` for the first `failures` calls to the file, then the real file; returns a connector pointed at the server. */
const setup = async (failures: number, first: Reply, limits: { maxRetries?: number; maxWaitSeconds?: number } = {}) => {
  let hits = 0;
  replay = await startReplay({ [FILE]: () => (hits++ < failures ? first : { status: 200, body: fixture("github/content") }) });
  // msPerSecond 1 turns each "Retry-After second" into one millisecond, so the test does not sleep.
  return buildGithubConnector({ id: "gh", owner: "acme", repo: "handbook", listToken: "t", baseUrl: replay.url, ...limits }, { msPerSecond: 1 });
};
const calls = () => replay.seen.filter((r) => decodeURIComponent(r.path).startsWith(FILE)).length;

describe("github rate limits", () => {
  it("retries a 429 secondary rate limit after Retry-After, then returns the file", async () => {
    const github = await setup(1, { status: 429, headers: { "retry-after": "1" }, body: SECONDARY });
    const doc = await github.fetch("docs/guide.md", { token: "u" });
    expect(doc.version).toBe("3d21ec53a331a6f037a91c368710b99387d012c1");
    expect(calls()).toBe(2);
  });

  it("retries a 403 primary rate limit once the quota reset time has passed", async () => {
    const reset = String(Math.floor(Date.now() / 1000) + 1);
    const github = await setup(1, {
      status: 403,
      headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": reset },
      body: { message: "API rate limit exceeded" },
    });
    expect((await github.fetch("docs/guide.md", { token: "u" })).text).toContain("Guide");
    expect(calls()).toBe(2);
  });

  it("gives up after maxRetries and raises RATE_LIMITED", async () => {
    const github = await setup(99, { status: 429, headers: { "retry-after": "1" }, body: SECONDARY }, { maxRetries: 2 });
    const error = await github.fetch("docs/guide.md", { token: "u" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamLimitError);
    expect((error as UpstreamLimitError).code).toBe("RATE_LIMITED");
    expect(calls()).toBe(3); // the first try plus two retries
  });

  it("does not sleep through a Retry-After longer than maxWaitSeconds", async () => {
    const github = await setup(99, { status: 429, headers: { "retry-after": "120" }, body: SECONDARY }, { maxWaitSeconds: 60 });
    await expect(github.fetch("docs/guide.md", { token: "u" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(calls()).toBe(1);
  });

  it("retries a 502 with the retry plugin", async () => {
    const github = await setup(1, { status: 502, body: { message: "Bad Gateway" } });
    expect((await github.fetch("docs/guide.md", { token: "u" })).version).toBe("3d21ec53a331a6f037a91c368710b99387d012c1");
    expect(calls()).toBe(2);
  });

  it("does not retry a plain 403, which is a permission error", async () => {
    const github = await setup(99, { status: 403, body: { message: "Forbidden" } });
    await expect(github.fetch("docs/guide.md", { token: "u" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls()).toBe(1);
  });
});
