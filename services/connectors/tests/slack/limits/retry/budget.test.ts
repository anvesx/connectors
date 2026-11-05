import { afterEach, describe, expect, it } from "vitest";
import { createSlackConnector } from "../../../../src/index.js";
import { fixture, type Replay, type Reply, startReplay } from "../../../../src/testing/replay.js";

const LIST = "/conversations.list";
let replay: Replay;
afterEach(() => replay.close());

const limited: Reply = { status: 429, headers: { "retry-after": "0" }, body: { ok: false, error: "ratelimited" } };
const down: Reply = { status: 503, body: "down" };
const ok: Reply = { status: 200, body: fixture("slack/channels/first") };
const run = async (replies: Reply[], retries: number) => {
  let n = 0;
  replay = await startReplay({ [LIST]: () => replies[n++] ?? ok });
  const slack = createSlackConnector({ id: "sl", listToken: "x", baseUrl: `${replay.url}/`, retries });
  return slack.list({ limit: 10 }).catch((e: unknown) => e);
};
const calls = () => replay.seen.filter((r) => r.path.startsWith(LIST)).length;

describe("slack retries is one budget per request, not one per layer", () => {
  it("three 429s then a 503 with retries 3 makes 4 calls, not 16", async () => {
    // Before: each of the SDK's 4 attempts restarted the 429 loop, so up to (3 + 1) x (3 + 1) = 16 calls.
    const error = await run([limited, limited, limited, down, down, down], 3);
    expect(error).toBeInstanceOf(Error);
    expect(calls()).toBe(4);
  });

  it("alternating 429 and 503 with retries 2 makes 3 calls, then the last 429 is RATE_LIMITED", async () => {
    // Calls: 429 (wait 0), 503 (backoff 500 ms), 429. The third is the last the budget allows.
    expect(await run([limited, down, limited, down], 2)).toMatchObject({ code: "RATE_LIMITED" });
    expect(calls()).toBe(3);
  });

  it("a 503 then success uses 2 calls and returns the channels", async () => {
    const result = await run([down], 3);
    expect(result).toMatchObject({ items: expect.any(Array) });
    expect(calls()).toBe(2);
  });

  it("503s alone with retries 1 make 2 calls", async () => {
    await run([down, down, down], 1);
    expect(calls()).toBe(2);
  });
});
