import { afterEach, describe, expect, it } from "vitest";
import { createDriveConnector, UpstreamLimitError } from "../../../src/index.js";
import { fixture, type Replay, type Reply, startReplay } from "../../../src/testing/replay.js";

const LIST = "/drive/v3/files";
let replay: Replay;
afterEach(() => replay.close());

const quota = (reason: string): Reply => ({
  status: 403,
  body: { error: { code: 403, message: "Rate Limit Exceeded", errors: [{ domain: "usageLimits", reason, message: "Rate Limit Exceeded" }] } },
});
const setup = async (failures: number, first: Reply, retries?: number) => {
  let hits = 0;
  replay = await startReplay({ [LIST]: () => (hits++ < failures ? first : { status: 200, body: fixture("drive/files-list") }) });
  return createDriveConnector({ id: "gd", listToken: "t", rootUrl: replay.url, ...(retries !== undefined && { retries }) });
};
const calls = () => replay.seen.filter((r) => r.path.startsWith(LIST)).length;

describe("drive quota 403", () => {
  it.each(["rateLimitExceeded", "userRateLimitExceeded"])("retries a 403 with reason %s, then returns the page", async (reason) => {
    const drive = await setup(1, quota(reason));
    expect((await drive.list({ limit: 10 })).items.length).toBeGreaterThan(0);
    expect(calls()).toBe(2);
  });

  it("raises RATE_LIMITED, not FORBIDDEN, when the quota outlasts the retries", async () => {
    const drive = await setup(99, quota("userRateLimitExceeded"), 2);
    const error = await drive.list({ limit: 10 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamLimitError);
    expect((error as UpstreamLimitError).code).toBe("RATE_LIMITED");
    expect(calls()).toBe(3);
  });

  it("keeps a plain 403 FORBIDDEN, with no retry", async () => {
    const drive = await setup(99, { status: 403, body: fixture("drive/errors/error-403") });
    await expect(drive.list({ limit: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls()).toBe(1);
  });

  it("canRead reports a quota 403 as RATE_LIMITED and a plain 403 as false", async () => {
    const canRead = async (reply: Reply) => {
      replay = await startReplay({ "/drive/v3/files/f1": reply });
      const result = createDriveConnector({ id: "gd", listToken: "t", rootUrl: replay.url, retries: 0 }).canRead?.("f1", { token: "u" });
      return result?.finally(() => replay.close());
    };
    await expect(canRead(quota("rateLimitExceeded"))).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(await canRead({ status: 403, body: fixture("drive/errors/error-403") })).toBe(false);
  });
});
