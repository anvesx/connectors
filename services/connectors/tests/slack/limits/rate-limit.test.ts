import { afterEach, describe, expect, it } from "vitest";
import { createSlackConnector, UpstreamLimitError } from "../../../src/index.js";
import { fixture, type Replay, startReplay } from "../../../src/testing/replay.js";

const LIST = "/conversations.list";
let replay: Replay;
afterEach(() => replay.close());

const limited = (retryAfter: string) => ({ status: 429, headers: { "retry-after": retryAfter }, body: { ok: false, error: "ratelimited" } });
const calls = () => replay.seen.filter((r) => r.path.startsWith(LIST)).length;
// `retries` is left unset on purpose: this exercises the connector's default.
const connector = (retries?: number) =>
  createSlackConnector({ id: "sl", listToken: "x", baseUrl: `${replay.url}/`, ...(retries !== undefined && { retries }) });

describe("slack rate limits", () => {
  it("retries a 429 once with the default retries, then returns the channels", async () => {
    let hits = 0;
    replay = await startReplay({ [LIST]: () => (hits++ < 1 ? limited("1") : { status: 200, body: fixture("slack/channels/first") }) });
    const { items } = await connector().list({ limit: 10 });
    expect(items.map((i) => i.address)).toEqual(["C01GEN", "G02LEAD"]);
    expect(calls()).toBe(2);
  });

  it("stops after the configured retries and raises RATE_LIMITED", async () => {
    replay = await startReplay({ [LIST]: limited("0") });
    const error = await connector(1)
      .list({ limit: 10 })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamLimitError);
    expect((error as UpstreamLimitError).code).toBe("RATE_LIMITED");
    expect(calls()).toBe(2); // the first try plus one retry
  });

  it("uses 3 retries by default: always-429 with Retry-After 0 makes 4 upstream calls, then RATE_LIMITED", async () => {
    replay = await startReplay({ [LIST]: limited("0") });
    await expect(connector().list({ limit: 10 })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(calls()).toBe(4);
  });
});
