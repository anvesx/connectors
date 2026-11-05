import { afterEach, describe, expect, it } from "vitest";
import { createDriveConnector, UpstreamLimitError } from "../../../src/index.js";
import { fixture, type Replay, type Reply, startReplay } from "../../../src/testing/replay.js";

const LIST = "/drive/v3/files";
let replay: Replay;
afterEach(() => replay.close());

/** Answers `first` for the first `failures` calls to files.list, then the real list; returns a connector pointed at the server. */
const setup = async (failures: number, first: Reply, retries?: number) => {
  let hits = 0;
  replay = await startReplay({ [LIST]: () => (hits++ < failures ? first : { status: 200, body: fixture("drive/files-list") }) });
  return createDriveConnector({ id: "gd", listToken: "t", rootUrl: replay.url, ...(retries !== undefined && { retries }) });
};
const calls = () => replay.seen.filter((r) => r.path.startsWith(LIST)).length;

describe("drive rate limits", () => {
  it("waits for Retry-After on a 429, retries, and then returns the page", async () => {
    const drive = await setup(1, { status: 429, headers: { "retry-after": "1" }, body: { error: { code: 429, message: "slow down" } } });
    const started = Date.now();
    const { items } = await drive.list({ limit: 10 });
    expect(items.length).toBeGreaterThan(0);
    expect(calls()).toBe(2);
    // gaxios's own first backoff is only 100 ms, so a wait near 1000 ms means the Retry-After header was honoured.
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
  });

  it("gives up after the configured retries and raises RATE_LIMITED", async () => {
    const drive = await setup(99, { status: 429, headers: { "retry-after": "0" }, body: { error: { code: 429, message: "slow down" } } }, 2);
    const error = await drive.list({ limit: 10 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamLimitError);
    expect((error as UpstreamLimitError).code).toBe("RATE_LIMITED");
    expect(calls()).toBe(3); // the first try plus two retries
  });

  it("retries a 503", async () => {
    const drive = await setup(1, { status: 503, body: { error: { code: 503, message: "unavailable" } } });
    expect((await drive.list({ limit: 10 })).items.length).toBeGreaterThan(0);
    expect(calls()).toBe(2);
  });

  it("does not retry a 403, which is a permission error", async () => {
    const drive = await setup(99, { status: 403, body: fixture("drive/errors/error-403") });
    await expect(drive.list({ limit: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls()).toBe(1);
  });
});
