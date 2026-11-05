import { afterEach, describe, expect, it } from "vitest";
import { createSlackConnector } from "../../../src/index.js";
import { fixture, type Replay, startReplay } from "../../../src/testing/replay.js";

const LIST = "/conversations.list";
let replay: Replay;
afterEach(() => replay.close());

const limited = (retryAfter?: string) => ({
  status: 429,
  ...(retryAfter && { headers: { "retry-after": retryAfter } }),
  body: { ok: false, error: "ratelimited" },
});
const calls = () => replay.seen.filter((r) => r.path.startsWith(LIST)).length;
const connector = (maxWaitSeconds?: number) =>
  createSlackConnector({ id: "sl", listToken: "x", baseUrl: `${replay.url}/`, ...(maxWaitSeconds !== undefined && { maxWaitSeconds }) });

describe("slack maxWaitSeconds", () => {
  it("fails at once, with no sleep, when Retry-After is 3600", async () => {
    replay = await startReplay({ [LIST]: limited("3600") });
    const started = Date.now();
    await expect(connector().list({ limit: 10 })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(calls()).toBe(1);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("fails at once when Retry-After is 61, one over the default of 60", async () => {
    replay = await startReplay({ [LIST]: limited("61") });
    await expect(connector().list({ limit: 10 })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(calls()).toBe(1);
  });

  it("waits through a Retry-After equal to maxWaitSeconds, honouring the header", async () => {
    let hits = 0;
    replay = await startReplay({ [LIST]: () => (hits++ < 1 ? limited("2") : { status: 200, body: fixture("slack/channels/first") }) });
    const started = Date.now();
    expect((await connector(2).list({ limit: 10 })).items).toHaveLength(2);
    expect(calls()).toBe(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(1900);
  });

  it("treats a 429 with no usable Retry-After as a one second wait", async () => {
    let hits = 0;
    replay = await startReplay({ [LIST]: () => (hits++ < 1 ? limited() : { status: 200, body: fixture("slack/channels/first") }) });
    const started = Date.now();
    expect((await connector().list({ limit: 10 })).items).toHaveLength(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
  });
});
