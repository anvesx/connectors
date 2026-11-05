import { afterEach, describe, expect, it } from "vitest";
import { buildGithubConnector } from "../../../../src/github/connector.js";
import { UpstreamLimitError } from "../../../../src/index.js";
import { fixture, type Replay, type Reply, startReplay } from "../../../../src/testing/replay.js";

const FILE = "/repos/acme/handbook/contents/docs/guide.md";
const R = "/repos/acme/handbook";
let replay: Replay;
afterEach(() => replay.close());
// A plain 429: a Retry-After header and no "secondary rate" message, which the throttling plugin ignores.
const plain = (retryAfter?: string): Reply => ({
  status: 429,
  ...(retryAfter && { headers: { "retry-after": retryAfter } }),
  body: { message: "Too Many Requests" },
});
const setup = async (failures: number, first: Reply, limits: { maxRetries?: number; maxWaitSeconds?: number } = {}, msPerSecond = 1) => {
  let hits = 0;
  replay = await startReplay({
    [FILE]: () => (hits++ < failures ? first : { status: 200, body: fixture("github/content") }),
    [R]: () => (hits++ < failures ? first : { status: 200, body: fixture("github/repo") }),
  });
  return buildGithubConnector({ id: "gh", owner: "acme", repo: "handbook", listToken: "t", baseUrl: replay.url, ...limits }, { msPerSecond });
};
const calls = () => replay.seen.length;
describe("github 429 with only a Retry-After header", () => {
  it("is retried after the header's wait, then returns the file", async () => {
    const github = await setup(1, plain("3"), {}, 100);
    const started = Date.now();
    expect((await github.fetch("docs/guide.md", { token: "u" })).text).toContain("Guide");
    expect(calls()).toBe(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(280); // 3 seconds at 100 ms each
  });

  it("stops after maxRetries and raises RATE_LIMITED", async () => {
    const github = await setup(99, plain("1"), { maxRetries: 2 });
    const error = await github.fetch("docs/guide.md", { token: "u" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamLimitError);
    expect((error as UpstreamLimitError).code).toBe("RATE_LIMITED");
    expect(calls()).toBe(3);
  });
  it("uses 3 retries by default", async () => {
    const github = await setup(99, plain("0"));
    await expect(github.fetch("docs/guide.md", { token: "u" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(calls()).toBe(4);
  });

  it("fails at once when Retry-After is over maxWaitSeconds, and retries when it equals it", async () => {
    const long = await setup(99, plain("61"));
    await expect(long.fetch("docs/guide.md", { token: "u" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(calls()).toBe(1);
    await replay.close();
    const edge = await setup(1, plain("5"), { maxWaitSeconds: 5 });
    expect((await edge.fetch("docs/guide.md", { token: "u" })).version).toBeDefined();
    expect(calls()).toBe(2);
  });
  it("is not retried without a Retry-After header", async () => {
    const github = await setup(99, plain());
    await expect(github.fetch("docs/guide.md", { token: "u" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(calls()).toBe(1);
  });
});

describe("github 403 rate limits that outlast the retries", () => {
  const primary = { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "0" }, body: { message: "API rate limit exceeded" } };
  const withRetryAfter = { status: 403, headers: { "retry-after": "0" }, body: { message: "Forbidden" } };

  it.each([
    ["a quota 403", primary, { maxRetries: 1 }],
    ["a 403 that carries Retry-After", withRetryAfter, {}],
  ])("%s becomes RATE_LIMITED, not FORBIDDEN", async (_n, reply, limits) => {
    const github = await setup(99, reply, limits);
    await expect(github.fetch("docs/guide.md", { token: "u" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("canRead reports the rate limit instead of answering false", async () => {
    const github = await setup(99, primary, { maxRetries: 0 });
    await expect(github.canRead?.("docs/guide.md", { token: "u" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});
