import { afterEach, describe, expect, it } from "vitest";
import { createDriveConnector } from "../../../src/index.js";
import { fixture, type Replay, startReplay } from "../../../src/testing/replay.js";

const LIST = "/drive/v3/files";
let replay: Replay;
afterEach(() => replay.close());

const reply = (status: number, retryAfter?: string) => ({
  status,
  ...(retryAfter && { headers: { "retry-after": retryAfter } }),
  body: { error: { code: status, message: "slow down" } },
});
const setup = async (failures: number, first: ReturnType<typeof reply>, config: { maxWaitSeconds?: number; retries?: number } = {}) => {
  let hits = 0;
  replay = await startReplay({ [LIST]: () => (hits++ < failures ? first : { status: 200, body: fixture("drive/files-list") }) });
  return createDriveConnector({ id: "gd", listToken: "t", rootUrl: replay.url, ...config });
};
const calls = () => replay.seen.length;

describe("drive maxWaitSeconds", () => {
  it("fails at once, with no sleep, when Retry-After is 3600", async () => {
    const drive = await setup(99, reply(429, "3600"));
    const started = Date.now();
    await expect(drive.list({ limit: 10 })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(calls()).toBe(1);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("fails at once when Retry-After is 61, one over the default of 60", async () => {
    const drive = await setup(99, reply(429, "61"));
    await expect(drive.list({ limit: 10 })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(calls()).toBe(1);
  });

  it("waits through a Retry-After equal to maxWaitSeconds, for the full header time", async () => {
    const drive = await setup(1, reply(429, "2"), { maxWaitSeconds: 2 });
    const started = Date.now();
    expect((await drive.list({ limit: 10 })).items.length).toBeGreaterThan(0);
    expect(calls()).toBe(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(1900);
  });

  it("never sleeps longer than maxWaitSeconds when the backoff outgrows it", async () => {
    // gaxios backoff is 100, 500, 1500, 3500 ms for retries 1 to 4: capped at 1 s that is 100 + 500 + 1000 + 1000 = 2.6 s, uncapped 5.6 s.
    const drive = await setup(99, reply(503), { maxWaitSeconds: 1, retries: 4 });
    const started = Date.now();
    await expect(drive.list({ limit: 10 })).rejects.toThrow();
    const elapsed = Date.now() - started;
    expect(calls()).toBe(5);
    expect(elapsed).toBeGreaterThanOrEqual(2500);
    expect(elapsed).toBeLessThan(4000);
  });

  it("does not retry a plain 400 or sleep for one", async () => {
    const drive = await setup(99, reply(400));
    await expect(drive.list({ limit: 10 })).rejects.toThrow();
    expect(calls()).toBe(1);
  });
});
