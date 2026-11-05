import { afterEach, describe, expect, it } from "vitest";
import { createGmailConnector, UpstreamLimitError } from "../../../src/index.js";
import { fixture, type Replay, type Reply, startReplay } from "../../../src/testing/replay.js";

const PROFILE = "/gmail/v1/users/me/profile";
let replay: Replay;
afterEach(() => replay.close());

const limited = (status: number, retryAfter?: string): Reply => ({
  status,
  ...(retryAfter && { headers: { "retry-after": retryAfter } }),
  body: { error: { code: status, message: "Rate Limit Exceeded", errors: [{ domain: "usageLimits", reason: "userRateLimitExceeded" }] } },
});
const setup = async (failures: number, first: Reply, config: { retries?: number; maxWaitSeconds?: number } = {}) => {
  let hits = 0;
  replay = await startReplay({ [PROFILE]: () => (hits++ < failures ? first : { status: 200, body: fixture("gmail/profile") }) });
  return createGmailConnector({ id: "gm", listToken: "t", rootUrl: replay.url, ...config });
};
const calls = () => replay.seen.length;
const baseline = (g: Awaited<ReturnType<typeof setup>>) => g.changes({ token: "u" });

describe("gmail rate limits", () => {
  it("retries a 429 after Retry-After, then returns the baseline", async () => {
    const gmail = await setup(1, limited(429, "1"));
    const started = Date.now();
    expect((await baseline(gmail)).next).toBe("5000");
    expect(calls()).toBe(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
  });

  it("retries a quota 403 and raises RATE_LIMITED when it outlasts the retries", async () => {
    const gmail = await setup(99, limited(403), { retries: 2 });
    const error = await baseline(gmail).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamLimitError);
    expect((error as UpstreamLimitError).code).toBe("RATE_LIMITED");
    expect(calls()).toBe(3);
  });

  it("uses 3 retries by default", async () => {
    const gmail = await setup(99, limited(429, "0"));
    await expect(baseline(gmail)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(calls()).toBe(4);
  });

  it("fails at once, with no sleep, when Retry-After is 3600", async () => {
    const gmail = await setup(99, limited(429, "3600"));
    const started = Date.now();
    await expect(baseline(gmail)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(calls()).toBe(1);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("keeps a plain 403 FORBIDDEN, with no retry", async () => {
    const gmail = await setup(99, { status: 403, body: fixture("gmail/errors/forbidden") });
    await expect(baseline(gmail)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls()).toBe(1);
  });
});
